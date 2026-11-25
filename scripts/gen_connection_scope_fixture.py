"""Independent stdlib vectors for classic/desktop handshake context bytes."""
import json,struct
from pathlib import Path
def lp(s):
 b=s.encode("utf-8");return struct.pack(">H",len(b))+b
rows=[]
for room in ["room-1","机-🌬"]:
 for scope in ["full","desktopOnly"]:
  for mode in ["pair","enroll","auth","resume"]:
   rows.append(dict(mode=mode,scope=scope,room=room,tag=("desktop-" if scope=="desktopOnly" else "")+mode,prologue=(lp("rdev-e2e/desktop/v1" if scope=="desktopOnly" else "rdev-e2e/v3")+lp(mode)+lp(room)).hex()))
Path(__file__).resolve().parents[1].joinpath("protocol/fixtures/connection-scope.json").write_text(json.dumps(rows,indent=2,ensure_ascii=False)+"\n")
