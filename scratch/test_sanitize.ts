
import { sanitizeHtml } from '../src/core/utils/sanitizeHtml';

const testHtml = `
  <div>
    <p>Script: H<sub>2</sub>O and E=mc<sup>2</sup></p>
    <ul><li>List item</li></ul>
    <span style="text-decoration-style: wavy; text-decoration: underline;">Wavy Underline</span>
    <ol><li>Ordered item</li></ol>
  </div>
`;

const result = sanitizeHtml(testHtml);

console.log('--- INPUT ---');
console.log(testHtml);
console.log('--- OUTPUT ---');
console.log(result);

if (result.includes('sub') && result.includes('sup') && result.includes('ul') && result.includes('text-decoration-style')) {
  console.log('\n✅ Sanitize SUCCESS: Tags and styles preserved.');
} else {
  console.log('\n❌ Sanitize FAILURE: Something was stripped.');
  if (!result.includes('sub')) console.log('- Missing <sub>');
  if (!result.includes('sup')) console.log('- Missing <sup>');
  if (!result.includes('ul')) console.log('- Missing <ul>');
  if (!result.includes('text-decoration-style')) console.log('- Missing style property');
}
