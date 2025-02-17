# -*- coding: utf-8 -*-

import argparse
import boto3
import mimetypes
import os


S3_ENDPOINT = 'https://s-ed1.cloud.gcore.lu'


def main(args):
    access_key = os.environ.get("S3_ACCESS_KEY")
    secret = os.environ.get("S3_SECRET_KEY")
    if not access_key:
        raise Exception("S3_ACCESS_KEY not set")
    if not secret:
        raise Exception("S3_SECRET_KEY not set")
    s3 = boto3.client(
        's3',
        aws_access_key_id=access_key,
        aws_secret_access_key=secret,
        endpoint_url=args.endpoint
    )
    for root, dirs, files in os.walk(args.src):
        for file_name in files:
            # Construct the full local path to the file
            local_file_path = os.path.join(root, file_name)
            
            # Construct the S3 key (object key) using the relative path of the file
            s3_key = os.path.join(args.dest, os.path.relpath(local_file_path, args.src))
            
            # Upload the file to S3
            extra_args = {
                'ACL': 'public-read',
                'ContentType': mimetypes.guess_type(local_file_path)[0] or 'application/octet-stream'
            }
            s3.upload_file(local_file_path, args.bucket, s3_key, ExtraArgs=extra_args)
            print(f"[OK] {local_file_path} -> s3://{args.bucket}/{s3_key}")


def parse_args():
    parser = argparse.ArgumentParser("Upload a build to the S3 bucket")
    parser.add_argument(
        "src",
        help="Source directory path"
    )
    parser.add_argument(
        "dest",
        help="Destination key prefix"
    )
    parser.add_argument(
        "-b", "--bucket",
        help="S3 bucket name"
    )
    parser.add_argument(
        "-e", "--endpoint",
        default=S3_ENDPOINT,
        help="S3 endpoint URL"
    )
    return parser.parse_args()


if __name__ == "__main__":
    main(parse_args())
