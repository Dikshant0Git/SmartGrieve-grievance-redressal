/**
 * Test Helper: Time Control
 *
 * Provides fake timer utilities for testing the 30-second bundle window
 * and any time-dependent logic (SLA, cron).
 *
 * Usage:
 *   beforeEach(() => freezeTime());
 *   afterEach(() => restoreTime());
 *   // In test: advanceTime(30000) to trigger bundle
 */

let _realDateNow;
let _frozenAt;

/**
 * Freeze Date.now() at a specific timestamp.
 * @param {number} [timestamp] - Unix ms. Defaults to current time.
 */
function freezeTime(timestamp) {
    _realDateNow = Date.now;
    _frozenAt = timestamp || _realDateNow.call(Date);
    Date.now = () => _frozenAt;
}

/**
 * Advance the frozen clock by `ms` milliseconds.
 * Also runs any pending Jest fake timers if enabled.
 * @param {number} ms
 */
function advanceTime(ms) {
    if (_frozenAt == null) throw new Error('Call freezeTime() before advanceTime()');
    _frozenAt += ms;
    // If jest fake timers are active, advance them too
    if (typeof jest !== 'undefined' && jest.isMockFunction && jest.advanceTimersByTime) {
        try { jest.advanceTimersByTime(ms); } catch { /* fake timers may not be active */ }
    }
}

/**
 * Restore real Date.now().
 */
function restoreTime() {
    if (_realDateNow) {
        Date.now = _realDateNow;
        _realDateNow = null;
        _frozenAt = null;
    }
}

/**
 * Get the current frozen timestamp.
 * @returns {number}
 */
function currentFrozenTime() {
    return _frozenAt;
}

module.exports = { freezeTime, advanceTime, restoreTime, currentFrozenTime };
