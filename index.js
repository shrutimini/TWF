const express = require('express');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const distances = {
  C1: { C2: 4, L1: 3 },
  C2: { C1: 4, L1: 2.5, C3: 3 },
  C3: { L1: 2, C2: 3 },
  L1: { C1: 3, C2: 2.5, C3: 2 },
};

const productInfo = {
  A: { center: 'C1', weight: 3 },
  B: { center: 'C1', weight: 2 },
  C: { center: 'C1', weight: 8 },
  D: { center: 'C2', weight: 12 },
  E: { center: 'C2', weight: 25 },
  F: { center: 'C2', weight: 15 },
  G: { center: 'C3', weight: 0.5 },
  H: { center: 'C3', weight: 1 },
  I: { center: 'C3', weight: 2 },
};

function calculateCostPerDistance(weight) {
  if (weight <= 5) return 10;
  let extraWeight = weight - 5;
  let cost = 10;
  while (extraWeight > 0) {
    cost += 8;
    extraWeight -= 5;
  }
  return cost;
}

function flattenOrder(order) {
  const list = [];
  for (let product in order) {
    const { center, weight } = productInfo[product] || {};
    for (let i = 0; i < order[product]; i++) {
      list.push({ product, center, weight });
    }
  }
  return list;
}

function getRequiredCenters(order) {
  const centers = new Set();
  for (let product in order) {
    if (order[product] > 0 && productInfo[product]) {
      centers.add(productInfo[product].center);
    }
  }
  return Array.from(centers);
}

function findPaths(start, requiredItems) {
  const deliveries = [];

  function dfs(path, location, itemsOnboard, deliveredItems, remainingItems, costSoFar, visited, log) {
    if (remainingItems.length === 0 && itemsOnboard.length === 0 && location === 'L1') {
      deliveries.push({ path, cost: costSoFar, log });
      return;
    }

    for (let next of Object.keys(distances[location])) {
      const segmentDistance = distances[location][next];
      const visitedKey = `${location}->${next}->${itemsOnboard.map(i => i.product).sort().join(',')}`;
      if (visited.has(visitedKey)) continue;

      visited.add(visitedKey);

      let newPath = [...path, next];
      let newLog = [...log];
      let newDelivered = [...deliveredItems];
      let newRemaining = [...remainingItems];
      let newOnboard = [...itemsOnboard];
      let segmentCost = 0;

      if (['C1', 'C2', 'C3'].includes(next)) {
        const picked = newRemaining.filter(i => i.center === next);
        newRemaining = newRemaining.filter(i => i.center !== next);
        newOnboard = [...newOnboard, ...picked];
      }

      if (next === 'L1' && newOnboard.length > 0) {
        newDelivered = [...newDelivered, ...newOnboard];
        newOnboard = [];
      }

      const carriedWeight = itemsOnboard.reduce((sum, i) => sum + i.weight, 0);
      const costPerUnit = calculateCostPerDistance(carriedWeight);
      segmentCost = costPerUnit * segmentDistance;

      newLog.push({
        from: location,
        to: next,
        weight: carriedWeight,
        distance: segmentDistance,
        cost: segmentCost
      });

      dfs(newPath, next, newOnboard, newDelivered, newRemaining, costSoFar + segmentCost, new Set(visited), newLog);
    }
  }

  const itemsList = flattenOrder(requiredItems);
  const possibleStarts = getRequiredCenters(requiredItems);
  for (let start of possibleStarts) {
    const onboard = itemsList.filter(i => i.center === start);
    const remaining = itemsList.filter(i => i.center !== start);
    dfs([start], start, onboard, [], remaining, 0, new Set(), []);
  }

  return deliveries;
}

app.post('cost-calculate', (req, res) => {
  const order = req.body;
  const allPaths = findPaths(null, order);

  if (allPaths.length === 0) {
    return res.status(400).json({ error: "No valid delivery path found." });
  }

  let best = allPaths.reduce((min, curr) => curr.cost < min.cost ? curr : min, allPaths[0]);

  res.json({
    minimum_cost: Math.round(best.cost),
    path: best.path,
    breakdown: best.log.map(s => ({
      from: s.from,
      to: s.to,
      weight: s.weight,
      distance: s.distance,
      segment_cost: Math.round(s.cost)
    }))
  });
});

app.listen(PORT, () => {
  console.log(`API running at http://localhost:${PORT}`);
});
