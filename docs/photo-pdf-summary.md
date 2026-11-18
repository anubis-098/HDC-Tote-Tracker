# Photo summary PDF

Administrators can select up to 30 Totes and download a PDF from either Dashboard (`/admin`) or Download photos (`/admin/photos`). The button uses a photo-document icon and shows a progress indicator while preparing the file.

The report uses A4 landscape with up to six photos per Tote page, preserving each image's proportions. The summary includes Tote code, status, truck registration, **Order No.** and Store. Photo captions include slot and upload time in Asia/Bangkok. Each Tote has a separate page, including an explicit empty-photo page when applicable. Missing historical Order numbers appear as `-`.

Text is written as native PDF text with embedded Loma fonts and HarfBuzz shaping, including Thai labels, Order numbers and Store names. It can be selected, searched and copied; only the logo and product photos are images. Long fields wrap instead of being flattened into a page-sized bitmap. Install the pinned `reportlab[shaping]` dependencies from `requirements.lock` when rebuilding Docker.

Container Loading reports also show Order No. in the Trip summary and Pallet photo captions. Its Pallet/Order details pages retain the complete Order list when a short photo caption cannot fit all values.
