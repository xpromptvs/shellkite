import Foundation
/// Exhaustive application boundary for a display-only host or authenticated viewer.
public enum DesktopOnlyPolicy {
 public static func isDisplay(_ source:String?)->Bool {
  guard let source,case .display(let id)?=parseSourceID(source),id>0,id<=Int(UInt32.max) else{return false}
  return sourceID(displayID:id)==source
 }
 public static func permits(_ message:InboundMessage,focusedSource:String?)->Bool {
  switch message {
  case .agent,.appsCapabilities,.appsList,.appsAdd,.appsRemove,.appsRestoreAll,.key,.termReply,
       .resize,.termWire,.terminalPause,.terminalResume,.termPalette,.listTerminals,.openTerminal,
       .reopenTerminal,.closeTerminal,.switchTerminal,.listTmux,.openTmux,.newTmux,.killTmux,
       .simTouch,.simText,.simAction,.fileGet:return false
  case .subscribe(let s,_),.unsubscribe(let s,_),.reattachSource(let s),.minimizeWindow(let s,_),
       .restoreWindow(let s),.setWindowPosition(let s,_,_),.focusSource(let s),.requestKeyframe(let s),
       .setSourcePrefs(let s,_,_),.setSourceSize(let s,_,_),.setSourceAudio(let s,_):return isDisplay(s)
  case .av1Reference(let reference):return isDisplay(reference.source)
  case .sourceInput(let command):
   switch command {
   case .capabilities:return true
   case .focus(let s,_):return s == nil || isDisplay(s)
   case .input(let s,_,let event):
    guard isDisplay(s) else{return false}
    switch event {case .simTouch,.simText:return false;case .touch,.hover,.scroll,.scrollFling,.scrollGesture,.winKey,.winKeysRelease:return true}
   }
  case .touch,.hover,.scroll,.scrollFling,.scrollGesture,.winKey:return isDisplay(focusedSource)
  case .winKeysRelease:return true
  case .setView(let surface,let fullscreen):
   guard surface == nil || surface == .windows else{return false}
   if let requested=fullscreen,let source=requested{return isDisplay(source)}
   return true
  case .moveTab(let tab,let before):return isDisplay(tab) && (before.map(isDisplay) ?? true)
  case .renameTab(let tab,_):return isDisplay(tab)
  case .pasteBegin(let begin):
   if case .window(let source,_)=begin.to{return isDisplay(source)}
   return false
  case .pasteData,.pasteEnd,.pasteCancel,.claimControl,.clientHello,.setPrefs,.requestThumbs,
       .listSources,.setRecovery,.setPlayoutDelay,.setVisibility,.receiverReport,.curtain:return true
  }
 }
}
