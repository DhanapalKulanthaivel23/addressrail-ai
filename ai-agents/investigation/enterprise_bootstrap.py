"""Manual first-admin bootstrap for the isolated training lab.

Run locally. Password is read privately from TTY, not process arguments or Git.
"""
import argparse
import getpass
from .enterprise import bootstrap_admin

def main():
    parser=argparse.ArgumentParser(description="Bootstrap a synthetic lab tenant admin")
    parser.add_argument("--db",required=True,help="Local SQLite path (not a public server)")
    parser.add_argument("--tenant",required=True,help="Synthetic tenant alias")
    parser.add_argument("--username",required=True,help="Synthetic admin login alias")
    opts=parser.parse_args()
    password=getpass.getpass("New training admin password (16+ characters): ")
    confirmation=getpass.getpass("Repeat training admin password: ")
    if password != confirmation:
        raise SystemExit("Passwords did not match; no admin added")
    try:
        bootstrap_admin(opts.db,opts.tenant,opts.username,password)
    except (ValueError,Exception) as exc:
        # Do not echo any passwords or private database values.
        raise SystemExit("Could not create local training admin; check aliases and duplicates") from None
    print("Local training tenant admin created. No default password or hosted account.")

if __name__=="__main__":
    main()
