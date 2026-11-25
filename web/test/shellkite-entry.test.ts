import {it,expect} from 'vitest';
import {connectionEntryFor} from '../src/lib/shellkite-entry';
it('moves root pairing links to the app without losing their query or secret fragment',()=>{
 expect(connectionEntryFor(new URL('https://shellkite.xpromptvs.com/?code=AbCd1234&token=t#pair=secret'))).toBe('https://shellkite.xpromptvs.com/app?code=AbCd1234&token=t#pair=secret');
 expect(connectionEntryFor(new URL('https://shellkite.xpromptvs.com/#pair=secret'))).toBe('https://shellkite.xpromptvs.com/app#pair=secret');
 expect(connectionEntryFor(new URL('https://shellkite.xpromptvs.com/#about'))).toBe(null);
});
it('keeps device-adoption ceremonies on the existing auth origin',()=>{
 expect(connectionEntryFor(new URL('https://shellkite.xpromptvs.com/#adopt=secret'))).toBe('https://app.xpromptvs.ai/#adopt=secret');
});
