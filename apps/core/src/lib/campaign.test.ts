// Guards the campaign boundary: signups before the end date get free Premium,
// after do not. (No infra — pure date comparison.)
import assert from 'node:assert'
import { campaignActive, CAMPAIGN_END } from './campaign'

const end = CAMPAIGN_END.getTime()
assert.equal(campaignActive(new Date(end - 1000)), true, 'active just before end date')
assert.equal(campaignActive(new Date(end + 1000)), false, 'inactive just after end date')

console.log('campaign.test: all assertions passed ✓')
