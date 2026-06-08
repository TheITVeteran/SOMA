// Test target for sandbox debate verification
export function calculateSum(a, b) {
  // Guard clause: enforce numeric contract at boundary to prevent type confusion attacks
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new TypeError('Both arguments must be numbers');
  }
  return a + b;
}
