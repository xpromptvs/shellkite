import Foundation
/// Project only known desktop state. Unknown future message kinds fail closed for restricted peers.
public enum DesktopStateProjection {
 public static func project(_ data:Data)->Data? {
  guard let object=(try? JSONSerialization.jsonObject(with:data)) as? [String:Any],let tag=object["t"] as? String,
        let projected=project(object,tag:tag) else{return nil}
  return try? JSONSerialization.data(withJSONObject:projected)
 }
 private static func fields(_ object:[String:Any],_ names:[String])->[String:Any] {
  var out:[String:Any]=[:];for name in names {out[name]=object[name]};return out
 }
 private static func displayRows(_ value:Any?,key:String,fields names:[String])->[[String:Any]] {
  ((value as? [[String:Any]]) ?? []).filter {DesktopOnlyPolicy.isDisplay($0[key] as? String)}.map {fields($0,names)}
 }
 private static func project(_ o:[String:Any],tag:String)->[String:Any]? {
  switch tag {
  case "control-state":
   var out=fields(o,["t","active","clients"]);out["accessScope"]="desktopOnly";out["sourceKinds"]=["display"];return out
  case "view-set":
   var out=fields(o,["t","version","recoveryOverrideBp","activeRecovery","playoutDelayMinMs","playoutDelayMaxMs","curtainUp"])
   var subs=displayRows(o["subs"],key:"source",fields:["source","scale","fps","bitrateBps","codec","activeCodec","activeDelivery","dcIndex","audio","audioOwner"])
   for i in subs.indices {if let owner=subs[i]["audioOwner"] as? String,!DesktopOnlyPolicy.isDisplay(owner){subs[i]["audioOwner"]=nil}}
   out["subs"]=subs
   let windows=displayRows(o["windows"],key:"source",fields:["source","minimized","x","y","name"])
   out["windows"]=windows;out["tabOrder"]=(o["tabOrder"] as? [String] ?? []).filter(DesktopOnlyPolicy.isDisplay)
   let focused=o["focused"] as? String
   out["focused"]=DesktopOnlyPolicy.isDisplay(focused) ? focused! as Any:(windows.first(where: {($0["minimized"] as? Bool) != true})?["source"] ?? NSNull())
   let fullscreen=(o["view"] as? [String:Any])?["fullscreen"] as? String
   out["view"]=["surface":"windows","fullscreen":DesktopOnlyPolicy.isDisplay(fullscreen) ? fullscreen! as Any:NSNull()]
   return out
  case "source-list":
   var out=fields(o,["t","display"]);out["sources"]=displayRows(o["sources"],key:"id",fields:["id","kind","name","inputCapable","running","w","h"]);return out
  case "source-status":return ["t":tag,"statuses":displayRows(o["statuses"],key:"id",fields:["id","live","w","h","pxW","pxH"])]
  case "source-thumb":
   guard DesktopOnlyPolicy.isDisplay(o["id"] as? String) else{return nil}
   return fields(o,["t","id","w","h","fmt","data","unavailable"])
  case "source-focus":
   if let source=o["source"] as? String,!DesktopOnlyPolicy.isDisplay(source){return nil}
   return o
  case "source-input-capabilities":
   var out=fields(o,["t","v"]);out["scrollGestures"]=["display"];return out
  case "av1-ref-bind","av1-ref-frame":
   guard DesktopOnlyPolicy.isDisplay(o["source"] as? String) else{return nil};return o
  case "cursor","host-info","host-update-status","paste-accepted","paste-done","paste-error","inputAck":return o
  default:return nil
  }
 }
}
