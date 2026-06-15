import json

with open("test_results.json") as f:
    data = json.load(f)

print("--- FAILED TEST SUITES ---")
failed_suites = []
for result in data.get("testResults", []):
    status = result.get("status")
    name = result.get("name")
    if status == "failed":
        failed_tests = []
        for assertion in result.get("assertionResults", []):
            if assertion.get("status") == "failed":
                failed_tests.append({
                    "title": assertion.get("title"),
                    "messages": assertion.get("failureMessages")
                })
        failed_suites.append({
            "name": name,
            "tests": failed_tests
        })

print(f"Total failed suites: {len(failed_suites)}")
for suite in failed_suites:
    print(f"\\nSuite: {suite['name']}")
    for test in suite["tests"]:
        print(f"  Test: {test['title']}")
        for msg in test["messages"]:
            first_line = msg.split('\n')[0]
            print(f"    Error: {first_line}")
