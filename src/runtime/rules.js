/**
 * My Game Engine 1.0 — Declarative Rule Engine
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Implements declarative WHEN/IF/DO wiring for gameplay logic.
 * Follows GAMEPLAY_FOUNDATION.md §7.3 and ARCHITECTURE.md §12.3.
 */

/**
 * Creates a simple declarative rule engine.
 *
 * @param {object} [context={}] - Shared context passed to condition and action callbacks.
 * @returns {object} Rule engine interface.
 */
export function createRuleEngine(context = {}) {
  const rules = [];

  return {
    /**
     * Registers a declarative rule.
     *
     * @param {object} rule
     * @param {string} rule.name - Human-readable name.
     * @param {string} rule.event - Triggering event name (WHEN).
     * @param {Function} [rule.condition] - Guard condition function (IF).
     * @param {Function} rule.action - Effect function (DO).
     */
    addRule({ name, event, condition = null, action }) {
      if (!event || typeof action !== 'function') {
        throw new Error('Rule must specify an event name and an action function');
      }
      rules.push({
        name: name || `rule_${rules.length + 1}`,
        event,
        condition,
        action
      });
    },

    /**
     * Evaluates all rules listening for an event.
     *
     * @param {string} eventName - The emitted event name.
     * @param {object} [payload={}] - Event payload data.
     * @param {object} [extraContext={}] - Per-trigger context overrides.
     * @returns {Array<string>} Names of rules that executed.
     */
    trigger(eventName, payload = {}, extraContext = {}) {
      const activeContext = { ...context, ...extraContext };
      const executed = [];

      for (const rule of rules) {
        if (rule.event !== eventName) continue;

        let shouldExecute = true;
        if (typeof rule.condition === 'function') {
          shouldExecute = Boolean(rule.condition(payload, activeContext));
        }

        if (shouldExecute) {
          rule.action(payload, activeContext);
          executed.push(rule.name);
        }
      }

      return executed;
    },

    /**
     * Returns count of registered rules.
     */
    count() {
      return rules.length;
    },

    /**
     * Clears all rules.
     */
    clear() {
      rules.length = 0;
    }
  };
}
