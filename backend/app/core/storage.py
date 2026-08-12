"""
Storage abstraction so the rest of the app never needs to know whether files
live on local disk or in S3-compatible object storage (R2, Backblaze, real
AWS S3 — same client, just a different endpoint_url).

Switch with USE_S3_STORAGE in .env. Local disk is fine for dev and for a
single-instance deployment, but breaks the moment you run more than one
server process/container, since each one only sees its own filesystem.
"""
import uuid
from pathlib import Path

from app.core.config import settings


class StorageBackend:
    async def save(self, contents: bytes, extension: str) -> str:
        """Saves file bytes, returns a storage_key that can later be passed to read()."""
        raise NotImplementedError

    async def read(self, storage_key: str) -> bytes:
        raise NotImplementedError


class LocalStorageBackend(StorageBackend):
    async def save(self, contents: bytes, extension: str) -> str:
        upload_dir = Path(settings.LOCAL_UPLOAD_DIR)
        upload_dir.mkdir(parents=True, exist_ok=True)
        stored_name = f"{uuid.uuid4()}{extension}"
        dest_path = upload_dir / stored_name
        dest_path.write_bytes(contents)
        return str(dest_path)

    async def read(self, storage_key: str) -> bytes:
        return Path(storage_key).read_bytes()


class S3StorageBackend(StorageBackend):
    def __init__(self):
        import boto3

        self.bucket = settings.S3_BUCKET
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT_URL,
            region_name=settings.S3_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )

    async def save(self, contents: bytes, extension: str) -> str:
        key = f"{uuid.uuid4()}{extension}"
        self.client.put_object(Bucket=self.bucket, Key=key, Body=contents)
        return key

    async def read(self, storage_key: str) -> bytes:
        obj = self.client.get_object(Bucket=self.bucket, Key=storage_key)
        return obj["Body"].read()


def get_storage_backend() -> StorageBackend:
    if settings.USE_S3_STORAGE:
        return S3StorageBackend()
    return LocalStorageBackend()
