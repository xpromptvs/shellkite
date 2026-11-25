import {connectionEntryFor} from '../lib/shellkite-entry';
const entry=connectionEntryFor(new URL(location.href));
if(entry)location.replace(entry);
