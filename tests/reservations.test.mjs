import test from 'node:test';
import assert from 'node:assert/strict';
import { koreaInput, koreaTime, koreaMonthRange, reservationValues, reservationsOverlap } from '../reservations.js';
import { createApi } from '../core.js';

const now = Date.parse('2026-11-17T00:00:00Z');
const valid = { start: '2026-11-18T13:00', end: '2026-11-18T15:00', user_name: '테스트 사용자', purpose: '합주연습', people: '3' };

test('Korean dates are independent of the browser timezone', () => {
  assert.equal(koreaTime('2026-11-18T13:00'), Date.parse('2026-11-18T04:00:00Z'));
  assert.equal(koreaInput('2026-11-17T15:30:00Z'), '2026-11-18T00:30');
  assert.ok(Number.isNaN(koreaTime('2026-02-30T12:00')));
});

test('two hours is allowed, invalid durations and inputs are rejected', () => {
  assert.equal(reservationValues(valid, now).people, 3);
  assert.equal(reservationValues({...valid,user_name:'  사용자  ',purpose:'기타교실'},now).user_name,'사용자');
  for (const change of [{end:'2026-11-18T15:01'}, {end:valid.start}, {end:'2026-11-18T12:59'}, {people:'0'}, {people:'1.5'}, {purpose:'  '}, {purpose:'개인연습'}, {user_name:'  '}, {user_name:'가'.repeat(101)}, {start:'2026-11-16T13:00'}]) {
    assert.throws(() => reservationValues({...valid,...change}, now));
  }
  assert.doesNotThrow(() => reservationValues({...valid,start:'2026-11-18T23:00',end:'2026-11-19T01:00'},now));
});

test('overlap excludes touching endpoints and includes containment', () => {
  const a=reservationValues(valid,now);
  assert.equal(reservationsOverlap(a,reservationValues({...valid,start:'2026-11-18T15:00',end:'2026-11-18T16:00'},now)),false);
  assert.equal(reservationsOverlap(a,reservationValues({...valid,start:'2026-11-18T12:00',end:'2026-11-18T13:00'},now)),false);
  assert.equal(reservationsOverlap(a,reservationValues({...valid,start:'2026-11-18T14:00',end:'2026-11-18T16:00'},now)),true);
  assert.equal(reservationsOverlap(a,a),true);
});

const config={supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'sb_publishable_test_key_for_unit_tests'};

test('booking retries reuse the request ID and passwords only travel in the RPC body', async () => {
  const values={id:'0e392c40-1c4a-4135-9748-8d985cd89d39',...reservationValues({...valid,password:'취소암호'},now)};
  let writes=0;
  const api=createApi(config,async (url,options) => {
    assert.equal(new URL(url).pathname,'/rest/v1/rpc/guitarhana_reserve_room_v1');
    assert.equal(new URL(url).search,'');
    assert.equal(JSON.parse(options.body).p_password,'취소암호');
    assert.equal(JSON.parse(options.body).p_id,values.id);
    writes++;
    if(writes===1) throw new Error('Connection lost');
    return new Response(JSON.stringify(values.id),{status:200});
  });
  await assert.rejects(api.reservationSubmit(values));
  await api.reservationSubmit(values);
  assert.equal(writes,2);
});

test('cancellation returns password failures without reporting success', async () => {
  const api=createApi(config,async (url,options) => {
    assert.equal(new URL(url).pathname,'/rest/v1/rpc/guitarhana_cancel_room_v1');
    assert.deepEqual(JSON.parse(options.body),{p_id:'test-id',p_password:'wrong'});
    return new Response(JSON.stringify('invalid_password'),{status:200});
  });
  assert.equal(await api.reservationCancel('test-id','wrong'),'invalid_password');
  const broken=createApi(config,async ()=>new Response('{}',{status:200}));
  await assert.rejects(broken.reservationCancel('test-id'));
});

test('password is optional and its length is bounded', () => {
  assert.equal(reservationValues(valid,now).password,'');
  assert.equal(reservationValues({...valid,password:'  secret  '},now).password,'  secret  ');
  assert.throws(()=>reservationValues({...valid,password:'a'.repeat(129)},now));
});

test('overlap rejection is preserved when this request was not saved', async () => {
  const api=createApi(config,async (url,options)=> options.method==='POST'
    ? new Response(JSON.stringify({code:'23P01'}),{status:409})
    : new Response('[]',{status:200}));
  await assert.rejects(api.reservationSubmit({id:'test',...reservationValues(valid,now)}),{code:'23P01'});
});

test('list queries include reservations crossing either midnight boundary', async () => {
  const api=createApi(config,async url=>{
    const query=new URL(url).searchParams;
    assert.equal(query.get('starts_at'),'lt.2026-11-18T15:00:00.000Z');
    assert.equal(query.get('ends_at'),'gt.2026-11-17T15:00:00.000Z');
    return new Response('[]',{status:200});
  });
  assert.deepEqual(await api.reservationsList('2026-11-17T15:00:00.000Z','2026-11-18T15:00:00.000Z'),[]);
});


test('monthly ranges use Korean midnight and handle year boundaries and leap years', () => {
  assert.deepEqual(koreaMonthRange('2026-11'), {from:'2026-10-31T15:00:00.000Z',to:'2026-11-30T15:00:00.000Z'});
  assert.deepEqual(koreaMonthRange('2026-12'), {from:'2026-11-30T15:00:00.000Z',to:'2026-12-31T15:00:00.000Z'});
  for (const [month,days] of [['2027-02',28],['2028-02',29]]) {
    const range=koreaMonthRange(month);
    assert.equal((Date.parse(range.to)-Date.parse(range.from))/86400000,days);
  }
  for (const value of ['', '2026-13', '2026-00', '2026-1', '2026-11-17']) assert.equal(koreaMonthRange(value),null);
});
