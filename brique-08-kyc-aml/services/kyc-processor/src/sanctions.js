// sanctions.js - checks against local & external lists (mock)
import fetch from 'node-fetch';

export async function checkSanctions(person) {
  // person: { name, dob, national_id }
  // 1) check local DB of banned names (molam_sanctions) -> mock query
  // 2) call external provider (optional)
  // return matches array

  const matches = [];

  // Mock sanctions check
  if (process.env.USE_MOCK_SANCTIONS === 'true') {
    // Mock: flag test names
    const bannedNames = ['John Criminal', 'Jane Fraudster', 'Test Terrorist'];
    if (person.name && bannedNames.some(banned => person.name.toLowerCase().includes(banned.toLowerCase()))) {
      matches.push({
        list: 'MOCK_SANCTIONS',
        name: person.name,
        match_score: 95.0,
        reason: 'Mock sanctions match for testing'
      });
    }
    return matches;
  }

  // Example: call a sanctions vendor API
  // const resp = await fetch(process.env.SANCTIONS_URL, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(person)
  // });
  // const data = await resp.json();
  // return data.matches || [];

  return matches;
}
