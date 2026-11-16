-- Images are stored in Workers KV, not R2, so the column holds a storage key
ALTER TABLE post_images RENAME COLUMN r2_key TO image_key;
