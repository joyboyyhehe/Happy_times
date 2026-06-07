async function main() {
  try {
    const res = await fetch('http://127.0.0.1:9222/json');
    const data = await res.json();
    console.log('Active Chrome Tabs:');
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error fetching Chrome tabs:', err);
  }
}
main();
