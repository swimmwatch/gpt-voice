"""MkDocs compatibility output for Material's language selector."""

from pathlib import Path
from shutil import copyfile

from mkdocs.plugins import event_priority


@event_priority(-200)
def on_post_build(config, **kwargs):
    """Publish non-canonical sitemap copies for Material's page-relative UI requests."""
    site_directory = Path(config["site_dir"])
    root_sitemap = site_directory / "sitemap.xml"

    if not root_sitemap.is_file():
        raise RuntimeError("MkDocs must generate the canonical root sitemap before locale compatibility copies.")

    for page_index in site_directory.rglob("index.html"):
        sitemap_copy = page_index.parent / "sitemap.xml"
        if sitemap_copy == root_sitemap:
            continue
        copyfile(root_sitemap, sitemap_copy)
