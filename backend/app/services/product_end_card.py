import logging
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from app.schemas.story import BrandingConfig, ProductOverlayInfo
from app.services.reel_composer import run_ffmpeg
from app.services.reel_duration import END_CARD_DURATION_SECONDS

logger = logging.getLogger(__name__)


# =========================================================
# END CARD COLORS
# =========================================================

END_CARD_BG = "#FBF6EE"
END_CARD_PRIMARY = "#7A2E18"
END_CARD_SECONDARY = "#B76E3C"
END_CARD_SOFT = "#F3E2CF"
END_CARD_TEXT = "#3B2118"

TEXT_COLOR = END_CARD_TEXT
SECONDARY_TEXT = END_CARD_SECONDARY

END_CARD_DURATION = END_CARD_DURATION_SECONDS


# =========================================================
# FONT HELPER
# =========================================================

def _load_font(size: int, bold: bool = False):
    candidates = []

    if bold:
        candidates.extend(
            [
                "C:/Windows/Fonts/georgiab.ttf",
                "C:/Windows/Fonts/segoeuib.ttf",
                "C:/Windows/Fonts/arialbd.ttf",
                "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
                "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
                "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
            ]
        )
    else:
        candidates.extend(
            [
                "C:/Windows/Fonts/georgia.ttf",
                "C:/Windows/Fonts/segoeui.ttf",
                "C:/Windows/Fonts/arial.ttf",
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
                "/System/Library/Fonts/Supplemental/Arial.ttf",
                "/Library/Fonts/Arial.ttf",
            ]
        )

    for candidate in candidates:
        if Path(candidate).exists():
            try:
                return ImageFont.truetype(candidate, size=size)
            except Exception as exc:
                logger.warning("Failed loading font %s: %s", candidate, exc)

    logger.warning("No TrueType font found for product end card (size=%d, bold=%s); falling back to default bitmap font", size, bold)
    return ImageFont.load_default()


# =========================================================
# PRICE FORMATTER
# =========================================================

def _format_price(value: str | None) -> str:
    value = str(value or "").strip()

    if not value:
        return ""

    if "₹" in value:
        return value

    try:
        number = float(
            value.replace(",", "")
            .replace("Rs.", "")
            .replace("Rs", "")
            .strip()
        )

        if number.is_integer():
            return f"₹{int(number):,}"

        return f"₹{number:,.2f}"

    except ValueError:
        return value


# =========================================================
# CENTER TEXT
# =========================================================

def _draw_centered_text(
    draw,
    text,
    y,
    font,
    fill,
    width,
):
    text = str(text)

    bbox = draw.textbbox(
        (0, 0),
        text,
        font=font,
    )

    text_width = bbox[2] - bbox[0]

    x = (width - text_width) // 2

    draw.text(
        (x, y),
        text,
        font=font,
        fill=fill,
    )


# =========================================================
# DECORATIVE ELEMENTS
# =========================================================

def _draw_decorative_corner(
    draw,
    x: int,
    y: int,
    scale: float = 1.0,
):
    color = END_CARD_SECONDARY

    size = int(24 * scale)

    draw.line(
        [
            (x - size, y),
            (x + size, y),
        ],
        fill=color,
        width=max(1, int(2 * scale)),
    )

    draw.line(
        [
            (x, y - size),
            (x, y + size),
        ],
        fill=color,
        width=max(1, int(2 * scale)),
    )

    draw.ellipse(
        [
            x - int(8 * scale),
            y - int(8 * scale),
            x + int(8 * scale),
            y + int(8 * scale),
        ],
        outline=color,
        width=max(1, int(2 * scale)),
    )


# =========================================================
# PRODUCT END CARD
# =========================================================

def create_product_end_card(
    output_path: Path,
    product: ProductOverlayInfo,
    brand_config: BrandingConfig,
    logo_path: Path | None,
    width: int,
    height: int,
    shop_name: str | None = None,
    cta_text: str | None = None,
) -> Path:

    image = Image.new(
        "RGB",
        (width, height),
        END_CARD_BG,
    )

    draw = ImageDraw.Draw(image)

    # =========================================================
    # FONTS
    # =========================================================

    logo_title_font = _load_font(62, bold=False)
    product_title_font = _load_font(74, bold=True)

    label_font = _load_font(27)
    value_font = _load_font(36, bold=True)
    price_font = _load_font(52, bold=True)
    cta_font = _load_font(30)

    center_x = width // 2

    # =========================================================
    # DECORATIVE BACKGROUND
    # =========================================================

    for offset in range(0, 260, 20):

        y_wave = height - 250 + offset

        draw.arc(
            [
                -300 + offset,
                y_wave - 180,
                width + 300 - offset,
                y_wave + 180,
            ],
            180,
            360,
            fill="#F4DFCA",
            width=10,
        )

    _draw_decorative_corner(
        draw,
        width - 115,
        110,
        1.0,
    )

    _draw_decorative_corner(
        draw,
        90,
        height - 170,
        0.8,
    )

    # =========================================================
    # LOGO
    # =========================================================

    current_y = 100

    if logo_path is not None:

        logo_path = Path(logo_path)

        if logo_path.exists():

            try:

                logo = Image.open(
                    logo_path
                ).convert("RGBA")

                max_logo_width = 260
                max_logo_height = 230

                logo.thumbnail(
                    (
                        max_logo_width,
                        max_logo_height,
                    ),
                    Image.Resampling.LANCZOS,
                )

                logo_x = (
                    width - logo.width
                ) // 2

                image.paste(
                    logo,
                    (
                        logo_x,
                        current_y,
                    ),
                    logo,
                )

                current_y += (
                    logo.height + 35
                )

            except Exception:
                pass

    # =========================================================
    # BRAND / SHOP NAME
    # =========================================================

    # IMPORTANT:
    # shop_name comes from the Upload Screen.
    # It has priority over brand_config.name.

    brand_name = (
        str(shop_name).strip()
        if shop_name
        else ""
    )

    if not brand_name:
        brand_name = (
            getattr(
                brand_config,
                "name",
                None,
            )
            or "Your Brand"
        )

    _draw_centered_text(
        draw,
        brand_name,
        current_y,
        logo_title_font,
        END_CARD_PRIMARY,
        width,
    )

    current_y += 110

    # =========================================================
    # PRODUCT NAME
    # =========================================================

    product_name = (
        product.product_name
        or product.category
        or "Product"
    )

    _draw_centered_text(
        draw,
        product_name,
        current_y,
        product_title_font,
        END_CARD_PRIMARY,
        width,
    )

    current_y += 115

    # =========================================================
    # DIVIDER
    # =========================================================

    draw.line(
        [
            (
                width // 2 - 110,
                current_y,
            ),
            (
                width // 2 + 110,
                current_y,
            ),
        ],
        fill=END_CARD_SECONDARY,
        width=2,
    )

    current_y += 65

    # =========================================================
    # PRODUCT DETAILS
    # =========================================================

    details = [
        (
            "Category",
            product.category,
        ),
        (
            "Material",
            product.material,
        ),
        (
            "Color",
            product.color,
        ),
        (
            "Code",
            product.product_code,
        ),
        (
            "Price",
            _format_price(product.price),
        ),
    ]

    # Remove empty fields
    details = [
        (label, value)
        for label, value in details
        if value
    ]

    row_height = 108

    label_x = 265
    value_x = 455

    for index, (label, value) in enumerate(details):

        row_y = (
            current_y
            + index * row_height
        )

        # -----------------------------------------------------
        # Decorative circle
        # -----------------------------------------------------

        circle_radius = 34
        circle_x = 180
        circle_y = row_y + 25

        draw.ellipse(
            [
                circle_x - circle_radius,
                circle_y - circle_radius,
                circle_x + circle_radius,
                circle_y + circle_radius,
            ],
            fill=END_CARD_SOFT,
        )

        # Small center dot

        draw.ellipse(
            [
                circle_x - 7,
                circle_y - 7,
                circle_x + 7,
                circle_y + 7,
            ],
            fill=END_CARD_SECONDARY,
        )

        # -----------------------------------------------------
        # Label
        # -----------------------------------------------------

        draw.text(
            (
                label_x,
                row_y - 5,
            ),
            label,
            font=label_font,
            fill=END_CARD_SECONDARY,
        )

        # -----------------------------------------------------
        # Value
        # -----------------------------------------------------

        draw.text(
            (
                value_x,
                row_y + 25,
            ),
            str(value),
            font=(
                price_font
                if label == "Price"
                else value_font
            ),
            fill=END_CARD_TEXT,
        )

    current_y += (
        len(details)
        * row_height
        + 30
    )

    # =========================================================
    # CTA BUTTON
    # =========================================================

    cta_width = 420
    cta_height = 76

    cta_x = (
        width - cta_width
    ) // 2

    cta_y = min(
        current_y,
        height - 210,
    )

    draw.rounded_rectangle(
        [
            cta_x,
            cta_y,
            cta_x + cta_width,
            cta_y + cta_height,
        ],
        radius=38,
        fill="#F5E3D0",
        outline="#D9A879",
        width=2,
    )

    active_cta = (
        cta_text
        or getattr(product, "cta_text", None)
        or getattr(brand_config, "cta_text", None)
        or "Wear Your Story"
    )
    _draw_centered_text(
        draw,
        active_cta,
        cta_y + 20,
        cta_font,
        END_CARD_PRIMARY,
        width,
    )

    # =========================================================
    # SAVE IMAGE
    # =========================================================

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    image.save(
        output_path,
        format="PNG",
    )

    return output_path


# =========================================================
# BUILD END CARD VIDEO
# =========================================================

def build_product_end_card_video(
    image_path: Path,
    output_path: Path,
    duration: float = END_CARD_DURATION,
    width: int = 1080,
    height: int = 1920,
    fps: int = 30,
) -> Path:

    run_ffmpeg(
        [
            "-y",

            # -----------------------------------------------------
            # End-card image
            # -----------------------------------------------------

            "-loop",
            "1",

            "-framerate",
            str(fps),

            "-i",
            str(image_path),

            # -----------------------------------------------------
            # Silent audio
            # -----------------------------------------------------

            "-f",
            "lavfi",

            "-i",
            "anullsrc=channel_layout=stereo:sample_rate=44100",

            # -----------------------------------------------------
            # Duration
            # -----------------------------------------------------

            "-t",
            str(duration),

            # -----------------------------------------------------
            # Video
            # -----------------------------------------------------

            "-vf",
            (
                f"scale={width}:{height}:"
                "force_original_aspect_ratio=decrease,"
                f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,"
                "format=yuv420p"
            ),

            "-r",
            str(fps),

            "-c:v",
            "libx264",

            "-preset",
            "veryfast",

            "-crf",
            "23",

            "-pix_fmt",
            "yuv420p",

            # -----------------------------------------------------
            # Audio
            # -----------------------------------------------------

            "-c:a",
            "aac",

            "-ar",
            "44100",

            "-ac",
            "2",

            "-b:a",
            "128k",

            "-shortest",

            "-movflags",
            "+faststart",

            str(output_path),
        ]
    )

    return output_path
