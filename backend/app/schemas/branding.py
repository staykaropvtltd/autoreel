from pydantic import BaseModel


class BrandConfig(BaseModel):
    """The application's single, central brand identity - loaded from
    assets/branding/brand.json (see app.services.brand_service). Every part
    of the app (website header, Reel intro/outro, persistent watermark,
    brand overlays) reads from this one config instead of a hard-coded
    name/logo, so switching brands is a config-file edit, not a code change.
    """

    name: str
    tagline: str | None = None
    logo: str | None = None
    primary_color: str | None = None
    secondary_color: str | None = None
    text_color: str | None = None
