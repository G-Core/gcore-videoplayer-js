# -*- coding: utf-8 -*-
# https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity

import argparse
import hashlib
import base64

def main(args):
    for path in args.path:
        m = hashlib.new(args.algorithm)
        with open(path, "rb") as f:
            m.update(f.read())
            hash = base64.b64encode(m.digest()).decode("utf-8")
            print(f"{args.algorithm}-{hash} {path}")


def parse_args():
    parser = argparse.ArgumentParser("Generate SRI hashes for the files in a build")
    parser.add_argument(
        "path",
        nargs="+",
        help="File paths"
    )
    parser.add_argument(
        "-a", "--algorithm",
        default="sha256",
        choices=["sha256", "sha384", "sha512"],
        help="Hash algorithm"
    )
    return parser.parse_args()


if __name__ == "__main__":
    main(parse_args())
