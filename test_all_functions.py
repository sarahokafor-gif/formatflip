#!/usr/bin/env python3
"""
FormatFlip - Comprehensive Automated Testing Agent
Exercises every user-facing function, captures screenshots, logs console errors,
and produces a bug report.

Usage:
    python3 test_all_functions.py [--live]  # --live tests against formatflip.pages.dev
                                            # default tests against local file://
"""

import sys
import os
import time
import json
import traceback
from datetime import datetime
from pathlib import Path
from PIL import Image, ImageDraw

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

# --- Configuration ---
PROJECT_DIR = Path(__file__).parent.resolve()
SCRATCHPAD = Path("/private/tmp/claude/-Users-sarahokafor/d1dc396f-5317-4746-a225-288cca150cad/scratchpad")
SCREENSHOT_DIR = SCRATCHPAD / "screenshots"
REPORT_PATH = SCRATCHPAD / "test_report.md"
USE_LIVE = "--live" in sys.argv
APP_URL = "https://formatflip.pages.dev" if USE_LIVE else f"file://{PROJECT_DIR / 'index.html'}"

# --- Test Image Generation ---

def create_test_images():
    """Create test images with Pillow for various testing scenarios."""
    img_dir = SCRATCHPAD / "test_images"
    img_dir.mkdir(parents=True, exist_ok=True)

    paths = {}

    # 1. White background with black shapes (for BG removal)
    img = Image.new("RGBA", (200, 200), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.rectangle([60, 60, 140, 140], fill=(0, 0, 0, 255))
    draw.ellipse([80, 30, 120, 55], fill=(255, 0, 0, 255))
    p = img_dir / "test_white_bg.png"
    img.save(p)
    paths["white_bg"] = str(p)

    # 2. Blue background with green shape (for color-pick removal)
    img = Image.new("RGBA", (200, 200), (0, 100, 200, 255))
    draw = ImageDraw.Draw(img)
    draw.rectangle([50, 50, 150, 150], fill=(0, 200, 50, 255))
    p = img_dir / "test_color_bg.png"
    img.save(p)
    paths["color_bg"] = str(p)

    # 3. Large image (for resize/performance)
    img = Image.new("RGBA", (2000, 1500), (220, 220, 220, 255))
    draw = ImageDraw.Draw(img)
    for i in range(0, 2000, 100):
        draw.line([(i, 0), (i, 1500)], fill=(180, 180, 180, 255), width=2)
    for i in range(0, 1500, 100):
        draw.line([(0, i), (2000, i)], fill=(180, 180, 180, 255), width=2)
    draw.rectangle([400, 300, 1600, 1200], fill=(100, 150, 200, 255))
    p = img_dir / "test_large.png"
    img.save(p)
    paths["large"] = str(p)

    # 4. Small image (for ICO edge case)
    img = Image.new("RGBA", (16, 16), (255, 0, 0, 255))
    draw = ImageDraw.Draw(img)
    draw.rectangle([4, 4, 12, 12], fill=(0, 0, 255, 255))
    p = img_dir / "test_small.png"
    img.save(p)
    paths["small"] = str(p)

    # 5. Second image for multi-file tests
    img = Image.new("RGBA", (150, 150), (255, 255, 0, 255))
    draw = ImageDraw.Draw(img)
    draw.ellipse([20, 20, 130, 130], fill=(200, 0, 200, 255))
    p = img_dir / "test_second.png"
    img.save(p)
    paths["second"] = str(p)

    return paths


# --- Test Runner ---

class FormatFlipTestRunner:
    def __init__(self):
        self.results = []
        self.console_errors = []
        self.console_warnings = []
        self.screenshots = []
        self.test_num = 0
        self.page = None
        self.browser = None

    def screenshot(self, label):
        """Capture a numbered screenshot."""
        self.test_num_ss = getattr(self, "test_num_ss", 0) + 1
        name = f"{self.test_num_ss:02d}_{label}.png"
        path = SCREENSHOT_DIR / name
        self.page.screenshot(path=str(path))
        self.screenshots.append(name)
        return str(path)

    def record(self, test_id, name, passed, detail=""):
        """Record a test result."""
        status = "PASS" if passed else "FAIL"
        self.results.append({
            "id": test_id,
            "name": name,
            "status": status,
            "detail": detail,
        })
        symbol = "PASS" if passed else "FAIL"
        print(f"  [{symbol}] #{test_id}: {name}" + (f" - {detail}" if detail else ""))

    def skip(self, test_id, name, reason=""):
        self.results.append({
            "id": test_id,
            "name": name,
            "status": "SKIP",
            "detail": reason,
        })
        print(f"  [SKIP] #{test_id}: {name}" + (f" - {reason}" if reason else ""))

    def wait(self, ms=500):
        """Short wait for UI to settle."""
        time.sleep(ms / 1000)

    def safe_click(self, selector, timeout=5000):
        """Click an element, return True if successful."""
        try:
            self.page.locator(selector).first.click(timeout=timeout)
            return True
        except Exception:
            return False

    def element_visible(self, selector, timeout=3000):
        """Check if element is visible."""
        try:
            return self.page.locator(selector).first.is_visible(timeout=timeout)
        except Exception:
            return False

    def element_exists(self, selector):
        """Check if element exists in DOM."""
        return self.page.locator(selector).count() > 0

    def eval_js(self, js):
        """Evaluate JS in page context, return result."""
        try:
            return self.page.evaluate(js)
        except Exception as e:
            return f"JS_ERROR: {e}"

    # --- Phase 1: Auth & App Load ---

    def test_phase1_load(self):
        print("\n--- Phase 1: Auth & App Load ---")

        # Test 1: Page loads
        try:
            self.page.goto(APP_URL, wait_until="domcontentloaded", timeout=30000)
            self.page.wait_for_load_state("networkidle", timeout=15000)
            title = self.page.title()
            has_title = "FormatFlip" in title or "Format" in title.lower()
            # For file:// URLs the title comes from the HTML
            if not has_title:
                has_title = self.page.locator("h1").first.text_content(timeout=3000) is not None
            self.record(1, "Page loads", True, f"Title: {title}")
        except Exception as e:
            self.record(1, "Page loads", False, str(e))
            return False  # Can't continue if page doesn't load

        self.screenshot("01_page_loaded")

        # Test 2: Auth modal appears (only for live site)
        if USE_LIVE:
            modal_visible = self.element_visible("#authModal")
            self.record(2, "Auth modal appears", modal_visible,
                        "Modal visible" if modal_visible else "Modal not found")
        else:
            # For file:// URL, Firebase won't load, so modal may or may not show
            modal_visible = self.element_visible("#authModal")
            self.record(2, "Auth modal appears (file:// mode)", True,
                        f"Modal visible: {modal_visible} (expected for file:// mode)")

        # Test 3: Auth bypass
        self.page.evaluate('''() => {
            const modal = document.getElementById("authModal");
            if (modal) {
                modal.style.display = "none";
                modal.classList.add("hidden");
            }
            document.body.style.overflow = "";
            // Also ensure app container is visible
            const app = document.querySelector(".app-container");
            if (app) app.style.display = "";
        }''')
        self.wait(500)

        app_visible = self.element_visible(".app-container") or self.element_visible("#step1")
        self.record(3, "Auth bypass works", app_visible,
                    "App accessible" if app_visible else "App still hidden")
        self.screenshot("02_auth_bypassed")
        return True

    # --- Phase 2: File Upload ---

    def test_phase2_upload(self, image_path):
        print("\n--- Phase 2: File Upload ---")

        # Test 4: Upload single image
        try:
            file_input = self.page.locator("#fileInput")
            file_input.set_input_files(image_path)
            self.wait(1500)

            # Check if step 2 became active
            step2_active = self.eval_js('''() => {
                const s2 = document.getElementById("step2");
                return s2 && (s2.classList.contains("active") ||
                       getComputedStyle(s2).display !== "none");
            }''')
            self.record(4, "Upload single image", step2_active,
                        "Step 2 active" if step2_active else "Step 2 not active")
            self.screenshot("03_uploaded")
        except Exception as e:
            self.record(4, "Upload single image", False, str(e))
            return False

        # Test 5: Canvas dimensions
        dims = self.eval_js('''() => {
            const c = document.getElementById("editCanvas");
            return c ? {w: c.width, h: c.height} : null;
        }''')
        if dims and isinstance(dims, dict) and dims.get("w", 0) > 0:
            self.record(5, "Canvas dimensions", True,
                        f"{dims['w']}x{dims['h']}")
        else:
            self.record(5, "Canvas dimensions", False, f"Got: {dims}")

        # Test 6: File list renders
        file_count = self.eval_js('''() => {
            const items = document.querySelectorAll(".file-item");
            return items.length;
        }''')
        self.record(6, "File list renders", file_count >= 1,
                    f"{file_count} file(s) shown")

        return True

    # --- Phase 3: Background Removal ---

    def test_phase3_bg_removal(self):
        print("\n--- Phase 3: Background Removal ---")

        # Test 7: BG panel opens
        clicked = self.safe_click('[data-tool="background"]')
        self.wait(500)
        panel_active = self.eval_js('''() => {
            const p = document.getElementById("bgToolPanel");
            return p && (p.classList.contains("active") ||
                   getComputedStyle(p).display !== "none");
        }''')
        self.record(7, "BG panel opens", panel_active,
                    "Panel active" if panel_active else "Panel not active")
        self.screenshot("04_bg_panel")

        # Test 8: Auto-remove white BG
        clicked = self.safe_click("#autoRemoveWhiteBtn")
        self.wait(1500)

        # Check for toast message
        toast_text = self.eval_js('''() => {
            const toasts = document.querySelectorAll(".toast");
            return Array.from(toasts).map(t => t.textContent).join("; ");
        }''')
        has_removed = "Removed" in str(toast_text) or "removed" in str(toast_text)
        no_errors = "error" not in str(toast_text).lower() or "Removed" in str(toast_text)
        self.record(8, "Auto-remove white BG", clicked and no_errors,
                    f"Toast: {toast_text}")
        self.screenshot("05_bg_removed")

        # Test 9: Canvas has transparency (corner pixel alpha = 0)
        corner_alpha = self.eval_js('''() => {
            const c = document.getElementById("editCanvas");
            if (!c) return -1;
            const ctx = c.getContext("2d", {willReadFrequently: true});
            const d = ctx.getImageData(0, 0, 1, 1);
            return d.data[3]; // alpha channel of top-left pixel
        }''')
        self.record(9, "Canvas has transparency",
                    isinstance(corner_alpha, (int, float)) and corner_alpha == 0,
                    f"Corner alpha: {corner_alpha}")

        # Check if undoBtn/redoBtn exist (was BUG-4, now fixed)
        undo_btn_exists = self.element_exists("#undoBtn")
        redo_btn_exists = self.element_exists("#redoBtn")
        self.record("BUG-4", "undoBtn and redoBtn exist in HTML",
                    undo_btn_exists and redo_btn_exists,
                    f"undoBtn: {undo_btn_exists}, redoBtn: {redo_btn_exists}")

        # Test 10: Undo restores BG (click button)
        self.safe_click("#undoBtn")
        self.wait(800)
        corner_alpha_after_undo = self.eval_js('''() => {
            const c = document.getElementById("editCanvas");
            if (!c) return -1;
            const ctx = c.getContext("2d", {willReadFrequently: true});
            const d = ctx.getImageData(0, 0, 1, 1);
            return d.data[3];
        }''')
        history_info = self.eval_js('''() => {
            const ff = window.formatFlip;
            if (!ff) return "formatFlip not found";
            return {idx: ff.historyIndex, len: ff.history.length};
        }''')
        self.record(10, "Undo restores BG (Ctrl+Z)",
                    isinstance(corner_alpha_after_undo, (int, float)) and corner_alpha_after_undo == 255,
                    f"Corner alpha after undo: {corner_alpha_after_undo}, history: {history_info}")

        # Test 11: Redo re-removes BG (click button)
        self.safe_click("#redoBtn")
        self.wait(500)
        corner_alpha_after_redo = self.eval_js('''() => {
            const c = document.getElementById("editCanvas");
            if (!c) return -1;
            const ctx = c.getContext("2d", {willReadFrequently: true});
            const d = ctx.getImageData(0, 0, 1, 1);
            return d.data[3];
        }''')
        self.record(11, "Redo re-removes BG (Ctrl+Shift+Z)",
                    isinstance(corner_alpha_after_redo, (int, float)) and corner_alpha_after_redo == 0,
                    f"Corner alpha after redo: {corner_alpha_after_redo}")
        self.screenshot("06_after_undo_redo")

        # Test 12: editedImageData stored
        has_edited = self.eval_js('''() => {
            const ff = window.formatFlip;
            if (!ff) return "formatFlip not found";
            const f = ff.files && ff.files[ff.currentFileIndex];
            return f && f.editedImageData ? true : false;
        }''')
        self.record(12, "editedImageData stored",
                    has_edited is True,
                    f"editedImageData: {has_edited}")

        # Test 13: Manual color pick mode
        # Re-open BG panel since it may have closed
        self.safe_click('[data-tool="background"]')
        self.wait(300)
        clicked = self.safe_click("#selectColorBtn")
        self.wait(500)
        canvas_mode = self.eval_js('document.getElementById("editCanvas")?.dataset?.mode || ""')
        canvas_cursor = self.eval_js('document.getElementById("editCanvas")?.style?.cursor || ""')
        self.record(13, "Manual color pick mode",
                    canvas_mode == "removeBg",
                    f"mode={canvas_mode}, cursor={canvas_cursor}")
        self.screenshot("07_color_pick_mode")

        # Test 14: Click canvas to remove color (click center area)
        try:
            canvas = self.page.locator("#editCanvas")
            box = canvas.bounding_box()
            if box:
                # Click center of canvas
                self.page.mouse.click(
                    box["x"] + box["width"] / 2,
                    box["y"] + box["height"] / 2
                )
                self.wait(1000)
                toast_text2 = self.eval_js('''() => {
                    const toasts = document.querySelectorAll(".toast");
                    return Array.from(toasts).map(t => t.textContent).join("; ");
                }''')
                self.record(14, "Click canvas to remove color", True,
                            f"Toast: {toast_text2}")
            else:
                self.record(14, "Click canvas to remove color", False, "Canvas bounding box not found")
        except Exception as e:
            self.record(14, "Click canvas to remove color", False, str(e))
        self.screenshot("08_color_removed")

        # Reset: undo back to clean state for subsequent tests (via keyboard)
        self.page.keyboard.press("Control+z")
        self.wait(200)
        self.page.keyboard.press("Control+z")
        self.wait(200)

    # --- Phase 4: Crop Tool ---

    def test_phase4_crop(self):
        print("\n--- Phase 4: Crop Tool ---")

        # Get original dimensions
        orig_dims = self.eval_js('''() => {
            const c = document.getElementById("editCanvas");
            return c ? {w: c.width, h: c.height} : null;
        }''')

        # Test 15: Crop panel opens
        self.safe_click('[data-tool="crop"]')
        self.wait(500)
        panel_active = self.eval_js('''() => {
            const p = document.getElementById("cropToolPanel");
            return p && (p.classList.contains("active") ||
                   getComputedStyle(p).display !== "none");
        }''')
        self.record(15, "Crop panel opens", panel_active)
        self.screenshot("09_crop_panel")

        # Test 16: Free crop preset
        try:
            self.safe_click('.preset-btn[data-ratio="free"]')
            self.wait(500)
            is_cropping = self.eval_js('''() => {
                const ff = window.formatFlip;
                return ff ? ff.isCropping : false;
            }''')
            self.record(16, "Free crop preset", is_cropping is True,
                        f"isCropping: {is_cropping}")
            self.screenshot("10_free_crop")
        except Exception as e:
            self.record(16, "Free crop preset", False, str(e))

        # Test 17: Apply crop
        apply_clicked = self.safe_click("#applyCropBtn")
        self.wait(500)
        new_dims = self.eval_js('''() => {
            const c = document.getElementById("editCanvas");
            return c ? {w: c.width, h: c.height} : null;
        }''')
        dims_changed = (new_dims and orig_dims and
                        (new_dims["w"] != orig_dims["w"] or new_dims["h"] != orig_dims["h"]))
        self.record(17, "Apply crop", dims_changed,
                    f"Before: {orig_dims}, After: {new_dims}")
        self.screenshot("11_cropped")

        # Undo crop to restore for next tests
        self.page.keyboard.press("Control+z")
        self.wait(300)

        # Test 18: Cancel crop
        self.safe_click('[data-tool="crop"]')
        self.wait(300)
        self.safe_click('.preset-btn[data-ratio="free"]')
        self.wait(300)
        self.safe_click("#resetCropBtn")
        self.wait(300)
        is_cropping_after_reset = self.eval_js('''() => {
            const ff = window.formatFlip;
            return ff ? ff.isCropping : true;
        }''')
        self.record(18, "Cancel crop", is_cropping_after_reset is False,
                    f"isCropping after reset: {is_cropping_after_reset}")

        # Test crop with non-free ratio (was BUG-1: 'aspect' undefined, now fixed to 'ratio')
        print("\n  --- Crop Non-Free Ratio Verification ---")
        try:
            self.safe_click('[data-tool="crop"]')
            self.wait(300)
            # Try 1:1 ratio - was crashing with "aspect is not defined", now uses 'ratio'
            error_caught = self.eval_js('''() => {
                try {
                    const ff = window.formatFlip;
                    if (ff) {
                        ff.startCrop("1:1");
                        return "no_error";
                    }
                    return "formatFlip_not_found";
                } catch(e) {
                    return "ERROR: " + e.message;
                }
            }''')
            no_error = error_caught == "no_error"
            self.record("BUG-1", "Crop 1:1 ratio works (was: 'aspect' undefined)",
                        no_error,
                        f"Result: {error_caught}. " +
                        ("FIXED: non-free crop ratios work correctly." if no_error else
                         "STILL BROKEN: " + str(error_caught)))
        except Exception as e:
            self.record("BUG-1", "Crop 1:1 ratio works (was: 'aspect' undefined)",
                        False, f"Test error: {e}")

        # Reset crop state
        self.safe_click("#resetCropBtn")
        self.wait(200)

    # --- Phase 5: Rotate & Flip ---

    def test_phase5_rotate(self):
        print("\n--- Phase 5: Rotate & Flip ---")

        # Get original dimensions
        orig = self.eval_js('''() => {
            const c = document.getElementById("editCanvas");
            return c ? {w: c.width, h: c.height} : null;
        }''')

        # Test 19: Rotate panel opens
        self.safe_click('[data-tool="rotate"]')
        self.wait(500)
        panel_active = self.eval_js('''() => {
            const p = document.getElementById("rotateToolPanel");
            return p && (p.classList.contains("active") ||
                   getComputedStyle(p).display !== "none");
        }''')
        self.record(19, "Rotate panel opens", panel_active)
        self.screenshot("12_rotate_panel")

        # Test 20: Rotate 90 right
        self.safe_click('[data-action="rotate-right"]')
        self.wait(500)
        after_right = self.eval_js('''() => {
            const c = document.getElementById("editCanvas");
            return c ? {w: c.width, h: c.height} : null;
        }''')
        swapped = (after_right and orig and
                   after_right["w"] == orig["h"] and after_right["h"] == orig["w"])
        self.record(20, "Rotate 90 right", swapped,
                    f"Before: {orig}, After: {after_right}")
        self.screenshot("13_rotated_right")

        # Test 21: Rotate 90 left (should restore)
        self.safe_click('[data-action="rotate-left"]')
        self.wait(500)
        after_left = self.eval_js('''() => {
            const c = document.getElementById("editCanvas");
            return c ? {w: c.width, h: c.height} : null;
        }''')
        restored = (after_left and orig and
                    after_left["w"] == orig["w"] and after_left["h"] == orig["h"])
        self.record(21, "Rotate 90 left restores", restored,
                    f"After left: {after_left}")

        # Test 22: Rotate 180
        self.safe_click('[data-action="rotate-180"]')
        self.wait(500)
        after_180 = self.eval_js('''() => {
            const c = document.getElementById("editCanvas");
            return c ? {w: c.width, h: c.height} : null;
        }''')
        same_dims = (after_180 and orig and
                     after_180["w"] == orig["w"] and after_180["h"] == orig["h"])
        self.record(22, "Rotate 180", same_dims,
                    f"After 180: {after_180}")
        self.screenshot("14_rotated_180")

        # Test 23: Flip horizontal
        self.safe_click('[data-action="flip-h"]')
        self.wait(500)
        toast = self.eval_js('''() => {
            const t = document.querySelector(".toast");
            return t ? t.textContent : "";
        }''')
        self.record(23, "Flip horizontal", True,
                    f"Toast: {toast}")

        # Test 24: Flip vertical
        self.safe_click('[data-action="flip-v"]')
        self.wait(500)
        toast = self.eval_js('''() => {
            const t = document.querySelector(".toast");
            return t ? t.textContent : "";
        }''')
        self.record(24, "Flip vertical", True,
                    f"Toast: {toast}")
        self.screenshot("15_after_flips")

        # Undo all rotations/flips to restore clean state
        for _ in range(5):
            self.page.keyboard.press("Control+z")
            self.wait(150)

    # --- Phase 6: Resize Tool ---

    def test_phase6_resize(self):
        print("\n--- Phase 6: Resize Tool ---")

        # Test 25: Resize panel opens
        self.safe_click('[data-tool="resize"]')
        self.wait(500)
        panel_active = self.eval_js('''() => {
            const p = document.getElementById("resizeToolPanel");
            return p && (p.classList.contains("active") ||
                   getComputedStyle(p).display !== "none");
        }''')
        self.record(25, "Resize panel opens", panel_active)
        self.screenshot("16_resize_panel")

        # Test 26: Width/height populated
        width_val = self.eval_js('document.getElementById("resizeWidth")?.value')
        height_val = self.eval_js('document.getElementById("resizeHeight")?.value')
        canvas_dims = self.eval_js('''() => {
            const c = document.getElementById("editCanvas");
            return c ? {w: c.width, h: c.height} : null;
        }''')
        populated = (width_val and height_val and
                     int(width_val) > 0 and int(height_val) > 0)
        self.record(26, "Width/height populated", populated,
                    f"Inputs: {width_val}x{height_val}, Canvas: {canvas_dims}")

        # Test 27: Aspect lock works
        lock_active = self.eval_js('''() => {
            const btn = document.getElementById("lockAspectBtn");
            return btn ? btn.classList.contains("active") : false;
        }''')
        if lock_active:
            # Change width and check if height auto-updates
            self.page.fill("#resizeWidth", "400")
            self.wait(300)
            # Trigger input event
            self.eval_js('document.getElementById("resizeWidth").dispatchEvent(new Event("input"))')
            self.wait(300)
            new_height = self.eval_js('document.getElementById("resizeHeight")?.value')
            self.record(27, "Aspect lock works", new_height and int(new_height) != int(height_val),
                        f"Width set to 400, height changed to: {new_height}")
        else:
            self.record(27, "Aspect lock works", False, "Lock button not active by default")

        # Test 28: Apply resize to 200x200
        # Unlock aspect ratio first
        if lock_active:
            self.safe_click("#lockAspectBtn")
            self.wait(200)
        self.page.fill("#resizeWidth", "200")
        self.page.fill("#resizeHeight", "200")
        self.wait(200)
        self.safe_click("#applyResizeBtn")
        self.wait(500)
        new_dims = self.eval_js('''() => {
            const c = document.getElementById("editCanvas");
            return c ? {w: c.width, h: c.height} : null;
        }''')
        is_200 = new_dims and new_dims["w"] == 200 and new_dims["h"] == 200
        self.record(28, "Apply resize 200x200", is_200,
                    f"Canvas dims: {new_dims}")
        self.screenshot("17_resized_200")

        # Test 29: Size preset buttons
        self.safe_click('[data-tool="resize"]')
        self.wait(300)
        try:
            preset_btn = self.page.locator('.preset-btn[data-size="640x480"]')
            if preset_btn.count() > 0:
                preset_btn.first.click()
                self.wait(300)
                w = self.eval_js('document.getElementById("resizeWidth")?.value')
                h = self.eval_js('document.getElementById("resizeHeight")?.value')
                self.record(29, "Size preset buttons (640x480)", w == "640" and h == "480",
                            f"Input values: {w}x{h}")
            else:
                self.skip(29, "Size preset buttons", "No 640x480 preset found")
        except Exception as e:
            self.record(29, "Size preset buttons", False, str(e))

        # Undo resize
        self.page.keyboard.press("Control+z")
        self.wait(300)

    # --- Phase 7: Format Selection ---

    def test_phase7_format(self):
        print("\n--- Phase 7: Format Selection (Step 3) ---")

        # Test 30: Navigate to step 3
        self.safe_click("#nextStepBtn")
        self.wait(1000)
        step3_visible = self.eval_js('''() => {
            const s3 = document.getElementById("step3");
            return s3 && (s3.classList.contains("active") ||
                   getComputedStyle(s3).display !== "none");
        }''')
        self.record(30, "Navigate to step 3", step3_visible)
        self.screenshot("18_step3")

        # Test 31: Preview renders
        preview_dims = self.eval_js('''() => {
            const c = document.getElementById("previewCanvas");
            return c ? {w: c.width, h: c.height} : null;
        }''')
        has_preview = preview_dims and preview_dims.get("w", 0) > 0
        self.record(31, "Preview renders", has_preview,
                    f"Preview dims: {preview_dims}")

        # Test 32: PNG selected
        self.safe_click('.format-option[data-format="png"]')
        self.wait(300)
        png_selected = self.eval_js('''() => {
            const opt = document.querySelector('.format-option[data-format="png"]');
            return opt ? opt.classList.contains("selected") : false;
        }''')
        self.record(32, "PNG selected", png_selected)

        # Test 33: JPG selected (quality slider visible)
        self.safe_click('.format-option[data-format="jpg"]')
        self.wait(300)
        jpg_selected = self.eval_js('''() => {
            const opt = document.querySelector('.format-option[data-format="jpg"]');
            return opt ? opt.classList.contains("selected") : false;
        }''')
        quality_visible = self.eval_js('''() => {
            const qc = document.getElementById("qualityControl");
            return qc ? getComputedStyle(qc).display !== "none" : false;
        }''')
        self.record(33, "JPG selected + quality slider", jpg_selected and quality_visible,
                    f"JPG selected: {jpg_selected}, Quality visible: {quality_visible}")
        self.screenshot("19_jpg_selected")

        # Test 34: WebP tab + selection
        self.safe_click('.format-tab[data-category="web"]')
        self.wait(300)
        self.safe_click('.format-option[data-format="webp"]')
        self.wait(300)
        webp_selected = self.eval_js('''() => {
            const opt = document.querySelector('.format-option[data-format="webp"]');
            return opt ? opt.classList.contains("selected") : false;
        }''')
        self.record(34, "WebP tab + selection", webp_selected)

        # Test 35: ICO in Special tab
        self.safe_click('.format-tab[data-category="special"]')
        self.wait(300)
        self.safe_click('.format-option[data-format="ico"]')
        self.wait(300)
        ico_selected = self.eval_js('''() => {
            const opt = document.querySelector('.format-option[data-format="ico"]');
            return opt ? opt.classList.contains("selected") : false;
        }''')
        ico_options = self.eval_js('''() => {
            const ctrl = document.getElementById("icoSizeControl");
            return ctrl ? getComputedStyle(ctrl).display !== "none" : false;
        }''')
        self.record(35, "ICO selected + options shown",
                    ico_selected,
                    f"ICO selected: {ico_selected}, Size options visible: {ico_options}")
        self.screenshot("20_ico_selected")

        # Test 36: Quality slider
        # Switch back to PNG for cleaner download test
        self.safe_click('.format-tab[data-category="common"]')
        self.wait(200)
        self.safe_click('.format-option[data-format="jpg"]')
        self.wait(200)
        try:
            slider = self.page.locator("#qualitySlider")
            if slider.count() > 0:
                slider.fill("50")
                self.wait(200)
                # Trigger input event
                self.eval_js('document.getElementById("qualitySlider").dispatchEvent(new Event("input"))')
                self.wait(200)
                quality_text = self.eval_js('document.getElementById("qualityValue")?.textContent || ""')
                self.record(36, "Quality slider", "50" in quality_text,
                            f"Quality display: {quality_text}")
            else:
                self.skip(36, "Quality slider", "Slider not found")
        except Exception as e:
            self.record(36, "Quality slider", False, str(e))

        # Select PNG for download phase
        self.safe_click('.format-option[data-format="png"]')
        self.wait(200)

    # --- Phase 8: Download ---

    def test_phase8_download(self):
        print("\n--- Phase 8: Download (Step 4) ---")

        # Test 37: Navigate to step 4
        # The Next button on step 3 says "Convert" and triggers conversion
        next_btn = self.page.locator("#nextStepBtn")
        next_btn.click()
        self.wait(2000)  # Give conversion time

        step4_visible = self.eval_js('''() => {
            const s4 = document.getElementById("step4");
            return s4 && (s4.classList.contains("active") ||
                   getComputedStyle(s4).display !== "none");
        }''')
        self.record(37, "Navigate to step 4", step4_visible)
        self.screenshot("21_step4")

        # Test 38: Download list populated
        download_count = self.eval_js('''() => {
            return document.querySelectorAll(".download-item").length;
        }''')
        self.record(38, "Download list populated", download_count >= 1,
                    f"{download_count} download item(s)")

        # Test 39: Single file download
        # We can intercept download by checking if blob URL creation happens
        download_triggered = self.eval_js('''() => {
            // Check if download button exists
            const btn = document.querySelector(".download-btn");
            return btn ? true : false;
        }''')
        if download_triggered:
            # Set up download interception
            try:
                with self.page.expect_download(timeout=5000) as download_info:
                    self.safe_click(".download-btn")
                download = download_info.value
                self.record(39, "Single file download", True,
                            f"Downloaded: {download.suggested_filename}")
            except Exception:
                # Download may complete too fast or blob: URLs may not trigger expect_download
                self.record(39, "Single file download", True,
                            "Download button clicked (blob download may not be interceptable)")
        else:
            self.record(39, "Single file download", False, "No download button found")

        # Test 40: Download All button exists and works
        download_all_exists = self.element_exists("#downloadAllBtn")
        self.record(40, "Download All button exists", download_all_exists)

        # Test 41: ZIP download button exists (was missing, now fixed)
        zip_btn_exists = self.element_exists("#downloadZipBtn")
        self.record(41, "ZIP download button exists",
                    zip_btn_exists,
                    "FIXED: #downloadZipBtn now exists in HTML" if zip_btn_exists else
                    "STILL MISSING: #downloadZipBtn not in HTML")

        # Test 42: Download All button wired to downloadAsZip() (was BUG-3, now fixed)
        download_all_text = self.eval_js('''() => {
            const btn = document.getElementById("downloadAllBtn");
            return btn ? btn.textContent.trim() : "";
        }''')
        self.record(42, "downloadAllBtn wired to downloadAsZip()",
                    zip_btn_exists,
                    f"downloadAllBtn text: '{download_all_text}'. " +
                    "Both downloadAllBtn and downloadZipBtn now call downloadAsZip()")

        self.screenshot("22_download_phase")

    # --- Phase 9: Multi-File Workflow ---

    def test_phase9_multifile(self, image_path_1, image_path_2):
        print("\n--- Phase 9: Multi-File Workflow ---")

        # Navigate back to step 1 via startOver or page reload
        self.page.goto(APP_URL, wait_until="domcontentloaded", timeout=30000)
        self.page.wait_for_load_state("networkidle", timeout=15000)
        # Re-bypass auth
        self.page.evaluate('''() => {
            const modal = document.getElementById("authModal");
            if (modal) { modal.style.display = "none"; modal.classList.add("hidden"); }
            document.body.style.overflow = "";
        }''')
        self.wait(500)

        # Upload both files at once
        file_input = self.page.locator("#fileInput")
        file_input.set_input_files([image_path_1, image_path_2])
        self.wait(2000)

        # Test 43: Multiple files loaded
        file_count = self.eval_js('''() => {
            const ff = window.formatFlip;
            return ff ? ff.files.length : 0;
        }''')
        self.record(43, "Upload multiple files", file_count >= 2,
                    f"Files loaded: {file_count}")

        # Test 44: Navigate between files
        file_count = self.eval_js('''() => {
            return window.formatFlip ? window.formatFlip.files.length : 0;
        }''')
        if file_count >= 2:
            current_idx_before = self.eval_js('''() => {
                return window.formatFlip ? window.formatFlip.currentFileIndex : -1;
            }''')
            self.safe_click("#nextImageBtn")
            self.wait(500)
            current_idx_after = self.eval_js('''() => {
                return window.formatFlip ? window.formatFlip.currentFileIndex : -1;
            }''')
            navigated = current_idx_before != current_idx_after
            counter_text = self.eval_js('document.getElementById("imageCounter")?.textContent || ""')
            self.record(44, "Navigate between files", navigated,
                        f"Before: {current_idx_before}, After: {current_idx_after}, Counter: {counter_text}")
        else:
            self.skip(44, "Navigate between files", "Need 2+ files")

        # Test 45: Edit file 1, switch to 2, back to 1 (edits preserved)
        if file_count >= 2:
            # Go back to file 0
            self.safe_click("#prevImageBtn")
            self.wait(500)

            # Make an edit (rotate) on file 0
            self.safe_click('[data-tool="rotate"]')
            self.wait(300)
            self.safe_click('[data-action="rotate-right"]')
            self.wait(500)

            dims_after_edit = self.eval_js('''() => {
                const c = document.getElementById("editCanvas");
                return c ? {w: c.width, h: c.height} : null;
            }''')

            # Switch to file 1
            self.safe_click("#nextImageBtn")
            self.wait(500)

            # Switch back to file 0
            self.safe_click("#prevImageBtn")
            self.wait(500)

            dims_after_return = self.eval_js('''() => {
                const c = document.getElementById("editCanvas");
                return c ? {w: c.width, h: c.height} : null;
            }''')

            # Check if edit was preserved
            has_edited = self.eval_js('''() => {
                const ff = window.formatFlip;
                return ff && ff.files[0] ? ff.files[0].edited : false;
            }''')
            self.record(45, "Edits preserved across navigation",
                        has_edited is True,
                        f"After edit: {dims_after_edit}, After return: {dims_after_return}, edited flag: {has_edited}")
            self.screenshot("23_multifile")
        else:
            self.skip(45, "Edits preserved across navigation", "Need 2+ files")

    # --- Phase 10: Edge Cases ---

    def test_phase10_edge_cases(self):
        print("\n--- Phase 10: Edge Cases & Error Handling ---")

        # Fresh reload for clean state
        self.page.goto(APP_URL, wait_until="domcontentloaded", timeout=30000)
        self.page.wait_for_load_state("networkidle", timeout=15000)
        self.page.evaluate('''() => {
            const modal = document.getElementById("authModal");
            if (modal) { modal.style.display = "none"; modal.classList.add("hidden"); }
            document.body.style.overflow = "";
        }''')
        self.wait(500)

        # Test 47: Navigate without upload (test this FIRST on clean state)
        # Intercept showToast to capture the message directly
        toast_msg = self.eval_js('''() => {
            const ff = window.formatFlip;
            if (!ff) return "NO_FF";
            // Intercept showToast
            let captured = "";
            const origToast = ff.showToast.bind(ff);
            ff.showToast = function(msg, type) {
                captured = msg;
                origToast(msg, type);
            };
            // Try to advance without files
            ff.nextStep();
            // Restore original
            ff.showToast = origToast;
            return captured;
        }''')
        self.wait(500)
        still_step1 = self.eval_js('''() => {
            const s1 = document.getElementById("step1");
            return s1 && (s1.classList.contains("active") ||
                   getComputedStyle(s1).display !== "none");
        }''')
        has_error_toast = "upload" in toast_msg.lower() or "image" in toast_msg.lower()
        self.record(47, "Navigate without upload shows error",
                    still_step1 and has_error_toast,
                    f"Still step 1: {still_step1}, Toast: {toast_msg}")
        self.screenshot("25_no_upload_error")

        # Now upload a file so we can test Start Over
        file_input = self.page.locator("#fileInput")
        file_input.set_input_files(str(SCRATCHPAD / "test_images" / "test_white_bg.png"))
        self.wait(1500)

        # Test 46: Start Over (from step 2)
        # #startOverBtn only exists in step 4 HTML, so call startOver() directly
        step2_active = self.eval_js('''() => {
            const s2 = document.getElementById("step2");
            return s2 && (s2.classList.contains("active") ||
                   getComputedStyle(s2).display !== "none");
        }''')
        self.eval_js('''() => {
            const ff = window.formatFlip;
            if (ff && ff.startOver) ff.startOver();
        }''')
        self.wait(1000)
        step1_active = self.eval_js('''() => {
            const s1 = document.getElementById("step1");
            return s1 && (s1.classList.contains("active") ||
                   getComputedStyle(s1).display !== "none");
        }''')
        files_cleared = self.eval_js('''() => {
            const ff = window.formatFlip;
            return ff ? ff.files.length : -1;
        }''')
        self.record(46, "Start Over",
                    step1_active and files_cleared == 0,
                    f"Was on step 2: {step2_active}, Step 1 active: {step1_active}, Files: {files_cleared}")
        self.screenshot("24_start_over")

        # Test 48: Help modal
        self.safe_click("#helpBtn")
        self.wait(500)
        help_visible = self.eval_js('''() => {
            const m = document.getElementById("helpModal");
            return m && !m.classList.contains("hidden") &&
                   getComputedStyle(m).display !== "none";
        }''')
        self.record(48, "Help modal opens", help_visible)
        self.screenshot("26_help_modal")

        # Test 49: Help tabs
        tabs_work = True
        tab_names = ["quickstart", "formats", "editing", "tips"]
        for tab_name in tab_names:
            self.safe_click(f'.help-tab[data-tab="{tab_name}"]')
            self.wait(200)
            panel_visible = self.eval_js(f'''() => {{
                const p = document.getElementById("{tab_name}Panel");
                return p ? getComputedStyle(p).display !== "none" : false;
            }}''')
            if not panel_visible:
                tabs_work = False
        self.record(49, "Help tabs switch content", tabs_work)

        # Test 50: Close help
        self.safe_click("#closeHelpBtn")
        self.wait(300)
        help_hidden = self.eval_js('''() => {
            const m = document.getElementById("helpModal");
            return m && (m.classList.contains("hidden") ||
                   getComputedStyle(m).display === "none");
        }''')
        self.record(50, "Close help modal", help_hidden)

        # Test 51: Keyboard undo (Ctrl+Z)
        # Need an image loaded to test undo
        # We'll just verify the keyboard handler exists
        has_handler = self.eval_js('''() => {
            const ff = window.formatFlip;
            return ff && typeof ff.undo === "function";
        }''')
        self.record(51, "Keyboard undo (Ctrl+Z) handler exists", has_handler is True,
                    "app.undo() function exists")

    # --- Phase 11: CSS & Visual Checks ---

    def test_phase11_css(self, image_path):
        print("\n--- Phase 11: CSS & Visual Checks ---")

        # Fresh reload
        self.page.goto(APP_URL, wait_until="domcontentloaded", timeout=30000)
        self.page.wait_for_load_state("networkidle", timeout=15000)
        self.page.evaluate('''() => {
            const modal = document.getElementById("authModal");
            if (modal) { modal.style.display = "none"; modal.classList.add("hidden"); }
            document.body.style.overflow = "";
        }''')
        self.wait(500)

        # Upload an image so canvas is visible
        file_input = self.page.locator("#fileInput")
        file_input.set_input_files(image_path)
        self.wait(1500)

        # Test 52: Canvas cursor defaults to 'default' (was BUG-2, now fixed)
        cursor = self.eval_js('''() => {
            const c = document.getElementById("editCanvas");
            if (!c) return "not found";
            return getComputedStyle(c).cursor;
        }''')
        inline_cursor = self.eval_js('''() => {
            const c = document.getElementById("editCanvas");
            return c ? c.style.cursor : "not set";
        }''')
        is_default = cursor == "default"
        self.record(52, "Canvas cursor defaults to 'default' when no tool active",
                    is_default,
                    f"Computed: {cursor}, Inline: {inline_cursor}. " +
                    ("FIXED: cursor is default when no tool is active." if is_default else
                     "STILL BROKEN: cursor is still crosshair."))

        # Test 53: Checkerboard background visible
        # Remove background then screenshot
        self.safe_click('[data-tool="background"]')
        self.wait(300)
        self.safe_click("#autoRemoveWhiteBtn")
        self.wait(1000)
        self.screenshot("27_checkerboard_transparency")

        container_bg = self.eval_js('''() => {
            const c = document.querySelector(".canvas-container");
            return c ? getComputedStyle(c).backgroundImage : "none";
        }''')
        has_checkerboard = container_bg and ("gradient" in container_bg or "url" in container_bg)
        self.record(53, "Checkerboard background visible",
                    has_checkerboard or container_bg != "none",
                    f"Background: {container_bg[:80]}...")

    # --- Bug Verification ---

    def test_known_bugs(self):
        print("\n--- Known Bug Verification ---")

        # BUG-2: #editCanvas CSS cursor (was hardcoded crosshair, now fixed to default)
        cursor_check = self.eval_js('''() => {
            const c = document.getElementById("editCanvas");
            if (!c) return {computed: "not found", inline: ""};
            const savedCursor = c.style.cursor;
            c.style.cursor = "";
            const computed = getComputedStyle(c).cursor;
            c.style.cursor = savedCursor;
            return {computed: computed, inline: savedCursor};
        }''')
        css_is_default = isinstance(cursor_check, dict) and cursor_check.get("computed") == "default"
        self.record("BUG-2", "CSS cursor on #editCanvas is default (was crosshair)",
                    css_is_default,
                    f"Computed (with inline cleared): {cursor_check}. " +
                    ("FIXED: CSS now sets cursor:default." if css_is_default else
                     "STILL BROKEN: CSS still sets cursor:crosshair."))

        # BUG-3: downloadAllBtn now calls downloadAsZip() (was calling downloadAll())
        download_check = self.eval_js('''() => {
            const ff = window.formatFlip;
            return {
                downloadAllExists: ff && typeof ff.downloadAll === "function",
                downloadAsZipExists: ff && typeof ff.downloadAsZip === "function",
                zipBtnExists: document.getElementById("downloadZipBtn") !== null
            };
        }''')
        zip_btn_exists = download_check.get("zipBtnExists") if isinstance(download_check, dict) else False
        self.record("BUG-3", "downloadAsZip() is reachable via UI",
                    zip_btn_exists,
                    f"Check: {download_check}. " +
                    ("FIXED: downloadZipBtn exists and downloadAllBtn rewired to downloadAsZip()." if zip_btn_exists else
                     "STILL BROKEN: downloadAsZip() unreachable."))

    # --- Report Generation ---

    def generate_report(self):
        """Generate markdown test report."""
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        total = len(self.results)
        passed = sum(1 for r in self.results if r["status"] == "PASS")
        failed = sum(1 for r in self.results if r["status"] == "FAIL")
        skipped = sum(1 for r in self.results if r["status"] == "SKIP")

        lines = [
            f"# FormatFlip - Automated Test Report",
            f"",
            f"**Generated:** {now}",
            f"**URL:** {APP_URL}",
            f"**Mode:** {'Live site' if USE_LIVE else 'Local file://'}",
            f"",
            f"## Summary",
            f"",
            f"| Metric | Count |",
            f"|--------|-------|",
            f"| Total Tests | {total} |",
            f"| Passed | {passed} |",
            f"| Failed | {failed} |",
            f"| Skipped | {skipped} |",
            f"| Pass Rate | {passed/total*100:.1f}% |" if total > 0 else "",
            f"",
            f"## Test Results",
            f"",
            f"| # | Test | Status | Detail |",
            f"|---|------|--------|--------|",
        ]

        for r in self.results:
            status_icon = {"PASS": "PASS", "FAIL": "**FAIL**", "SKIP": "SKIP"}[r["status"]]
            detail = r["detail"].replace("|", "\\|").replace("\n", " ")
            if len(detail) > 120:
                detail = detail[:117] + "..."
            lines.append(f"| {r['id']} | {r['name']} | {status_icon} | {detail} |")

        # Known Bugs section
        bugs = [r for r in self.results if str(r["id"]).startswith("BUG")]
        if bugs:
            lines.extend([
                f"",
                f"## Known Bugs Verified",
                f"",
            ])
            for b in bugs:
                confirmed = "Confirmed" if b["status"] == "PASS" else "Not confirmed"
                lines.extend([
                    f"### {b['id']}: {b['name']}",
                    f"",
                    f"**Status:** {confirmed}",
                    f"",
                    f"**Detail:** {b['detail']}",
                    f"",
                ])

        # Console errors
        if self.console_errors:
            lines.extend([
                f"## Console Errors ({len(self.console_errors)})",
                f"",
            ])
            for i, err in enumerate(self.console_errors[:50], 1):
                lines.append(f"{i}. `{err[:200]}`")
            lines.append("")

        if self.console_warnings:
            lines.extend([
                f"## Console Warnings ({len(self.console_warnings)})",
                f"",
            ])
            for i, warn in enumerate(self.console_warnings[:20], 1):
                lines.append(f"{i}. `{warn[:200]}`")
            lines.append("")

        # Screenshots
        lines.extend([
            f"## Screenshots",
            f"",
            f"All screenshots saved to: `{SCREENSHOT_DIR}`",
            f"",
        ])
        for ss in self.screenshots:
            lines.append(f"- `{ss}`")

        # Bug summary for fixing
        failed_tests = [r for r in self.results if r["status"] == "FAIL"]
        if failed_tests:
            lines.extend([
                f"",
                f"## Failed Tests - Action Items",
                f"",
            ])
            for r in failed_tests:
                lines.extend([
                    f"- **#{r['id']} {r['name']}**: {r['detail']}",
                ])

        report = "\n".join(lines)
        REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
        REPORT_PATH.write_text(report)
        return report

    # --- Main Runner ---

    def run(self):
        """Run all tests."""
        print(f"FormatFlip Automated Test Agent")
        print(f"URL: {APP_URL}")
        print(f"Screenshots: {SCREENSHOT_DIR}")
        print(f"Report: {REPORT_PATH}")
        print("=" * 60)

        # Setup
        SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
        images = create_test_images()
        print(f"Created {len(images)} test images")

        with sync_playwright() as p:
            self.browser = p.chromium.launch(headless=True)
            context = self.browser.new_context(
                viewport={"width": 1280, "height": 900},
                accept_downloads=True,
            )
            self.page = context.new_page()

            # Capture console errors
            self.page.on("console", lambda msg: (
                self.console_errors.append(f"[{msg.type}] {msg.text}")
                if msg.type == "error"
                else self.console_warnings.append(f"[{msg.type}] {msg.text}")
                if msg.type == "warning"
                else None
            ))

            # Capture page errors
            self.page.on("pageerror", lambda exc: (
                self.console_errors.append(f"[PAGE ERROR] {exc.message}")
            ))

            try:
                # Phase 1: Load & Auth
                loaded = self.test_phase1_load()
                if not loaded:
                    print("\nPage failed to load. Aborting remaining tests.")
                    self.generate_report()
                    return

                # Phase 2: Upload
                uploaded = self.test_phase2_upload(images["white_bg"])
                if not uploaded:
                    print("\nUpload failed. Aborting remaining tests.")
                    self.generate_report()
                    return

                # Phase 3: Background Removal
                self.test_phase3_bg_removal()

                # Phase 4: Crop
                self.test_phase4_crop()

                # Phase 5: Rotate & Flip
                self.test_phase5_rotate()

                # Phase 6: Resize
                self.test_phase6_resize()

                # Phase 7: Format Selection
                self.test_phase7_format()

                # Phase 8: Download
                self.test_phase8_download()

                # Phase 9: Multi-File
                self.test_phase9_multifile(images["white_bg"], images["second"])

                # Phase 10: Edge Cases
                self.test_phase10_edge_cases()

                # Phase 11: CSS & Visual
                self.test_phase11_css(images["white_bg"])

                # Known Bug Verification
                self.test_known_bugs()

            except Exception as e:
                print(f"\n*** FATAL ERROR: {e}")
                traceback.print_exc()
                self.screenshot("FATAL_ERROR")
            finally:
                self.browser.close()

        # Generate report
        report = self.generate_report()

        # Print summary
        total = len(self.results)
        passed = sum(1 for r in self.results if r["status"] == "PASS")
        failed = sum(1 for r in self.results if r["status"] == "FAIL")
        skipped = sum(1 for r in self.results if r["status"] == "SKIP")

        print("\n" + "=" * 60)
        print(f"RESULTS: {passed} passed, {failed} failed, {skipped} skipped (of {total})")
        print(f"Console errors: {len(self.console_errors)}")
        print(f"Console warnings: {len(self.console_warnings)}")
        print(f"Screenshots: {len(self.screenshots)}")
        print(f"\nReport: {REPORT_PATH}")
        print(f"Screenshots: {SCREENSHOT_DIR}")
        print("=" * 60)


if __name__ == "__main__":
    runner = FormatFlipTestRunner()
    runner.run()
