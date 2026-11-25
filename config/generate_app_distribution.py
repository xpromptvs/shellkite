import json,sys
source, official, out=sys.argv[1:]
p=json.load(open(source))
with open(out,'w') as f:
 f.write('public enum AppDistribution {\n')
 f.write(' public static let official = '+official+'\n')
 for key in ['name','bundleID','sourceBundleID','clientURL','serviceURL','rpID']:
  f.write(' public static let '+key+' = '+json.dumps(p[key])+'\n')
 f.write(' public static let updatesEnabled = '+str(p['updatesEnabled']).lower()+'\n}\n')
