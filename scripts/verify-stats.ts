
const BASE_URL = 'http://localhost:3001/api';

async function api(method: string, path: string, body?: any) {
    const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`API Error ${res.status}: ${text}`);
    }
    return res.json();
}

async function run() {
    console.log('Starting Verification...');
    const id1 = 'test-' + Date.now();
    const id2 = 'test-2-' + Date.now();
    const strategy = 'Silver Bullet';

    // 1. Insert Trade 1 (WIN)
    console.log('1. Inserting Trade 1 (WIN)...');
    await api('POST', '/trades', {
        id: id1,
        pair: 'BTCUSD',
        direction: 'LONG',
        entryPrice: 50000,
        exitPrice: 51000,
        outcome: 'WIN',
        pnl: 1000,
        strategy,
        timestamp: Date.now()
    });

    // 2. Check Stats
    console.log('2. Checking Stats...');
    let strategies = (await api('GET', '/strategies')).strategies;
    let strat = strategies.find((s: any) => s.strategy === strategy);
    console.log('Strategy Stats:', strat);

    if (!strat || strat.win_count < 1) {
        console.error('FAILED: Stats did not update correctly.');
    } else {
        console.log('PASSED: Stats updated.');
    }

    // 3. Insert Trade 2 (LOSS)
    console.log('3. Inserting Trade 2 (LOSS)...');
    await api('POST', '/trades', {
        id: id2,
        pair: 'BTCUSD',
        direction: 'LONG',
        entryPrice: 50000,
        exitPrice: 49000,
        outcome: 'LOSS',
        pnl: -1000,
        strategy,
        timestamp: Date.now()
    });

    // 4. Check Stats again
    console.log('4. Checking Stats again...');
    strategies = (await api('GET', '/strategies')).strategies;
    strat = strategies.find((s: any) => s.strategy === strategy);
    console.log('Strategy Stats:', strat);

    if (strat.loss_count < 1) {
        console.error('FAILED: Stats did not count loss.');
    } else {
        console.log('PASSED: Stats counted loss.');
    }

    // 5. Idempotency Test (Insert Trade 1 again as OPEN)
    console.log('5. Idempotency Test (Duplicate ID)...');
    try {
        await api('POST', '/trades', {
            id: id1,
            pair: 'BTCUSD',
            direction: 'LONG',
            entryPrice: 50000,
            outcome: 'OPEN', // Attempt to reset it?
            strategy,
            timestamp: Date.now()
        });
        // Note: server logic for POST /trades currently does INSERT. 
        // db.ts has UPSERT. So this should succeed and UPDATE the trade to OPEN.
        // Wait, if it updates to OPEN, then stats should decrease?
        console.log('Duplicate Insert Succeeded (UPSERT works).');
    } catch (e) {
        console.error('Duplicate Insert Failed:', e);
    }

    // Check stats - if it reverted to OPEN, win count should decrease
    strategies = (await api('GET', '/strategies')).strategies;
    strat = strategies.find((s: any) => s.strategy === strategy);
    console.log('Strategy Stats after duplicate:', strat);

    // 6. Calendar Stats
    console.log('6. Checking Calendar Stats...');
    const calendar = (await api('GET', '/calendar')).calendar;
    console.log('Calendar First Entry:', calendar[0]);
    if (calendar.length > 0 && calendar[0].trade_count > 0) {
        console.log('PASSED: Calendar stats return data.');
    } else {
        console.error('FAILED: Calendar stats empty.');
    }
}

run().catch(console.error);
