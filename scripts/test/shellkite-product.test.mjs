import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {product} from '../lib/shellkite-product.mjs';
import {resolveProductFeatures} from '../lib/product-features.mjs';
import {validateManifest} from '../lib/release-manifest.mjs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
test('product identities and paths are independent',()=>{
 assert.equal(product.name,'Shellkite');assert.equal(product.bundleID,'ai.xpromptvs.shellkite');assert.equal(product.sourceBundleID,'com.xpromptvs.shellkite.development');assert.equal(product.clientURL,'https://shellkite.xpromptvs.com/app');
 const build=read('app/BUILD.bazel');assert.ok(build.includes(product.bundleID));assert.ok(build.includes(product.sourceBundleID));assert.ok(build.includes('name = "Shellkite"'));
 assert.ok(!read('app/Info-official.plist').includes('<string>rdev</string>'));
 assert.ok(!read('app/Core/AppProfile.swift').includes('AppDistribution.official ? nil'));
});
test('all profiles enforce desktop-only with no agents or glasses',()=>{
 for(const profile of ['development','publication'])assert.deepEqual(resolveProductFeatures(profile),{graphicalAgents:false,glasses:false,desktopOnly:true});
 assert.match(read('host/RdevCore/Sources/RdevCore/HostConfig.swift'),/accessScope: ConnectionScope = \.desktopOnly/);
 assert.match(read('host/RdevHostKit/Sources/RdevHostKit/ChannelHub.swift'),/accessScopeLimit = ProductFeatures.desktopOnly \? \.desktopOnly/);
});
test('Xpromptvs manifests can never become Shellkite updates',()=>{
 const old={channel:'public',build:14,version:'0.2.0',revision:'x',published:true,artifactURL:'https://github.com/xpromptvs/xpromptvs/releases/download/public-14/Shellkite.dmg',size:100,sha256:'a'.repeat(64)};
 assert.throws(()=>validateManifest(old,'public'));
 const valid={...old,product:'shellkite',artifactURL:'https://github.com/xpromptvs/shellkite/releases/download/public-14/Shellkite.dmg'};
 assert.equal(validateManifest(valid,'public'),valid);
 assert.throws(()=>validateManifest({...valid,product:'xpromptvs'},'public'));
});
