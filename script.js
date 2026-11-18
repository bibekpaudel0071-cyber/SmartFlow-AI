

const intersection = document.getElementById("intersection");
const carLayer = document.getElementById("cars");

let aiModel = null;
let aiPriority = "North-South";
let waitNS = 0;
let waitEW = 0;
let lastAICycle = -1;

async function loadAIModel() {
  try {
    const response = await fetch("traffic_model.json");

    if (!response.ok) {
      throw new Error("Could not load traffic_model.json");
    }

    aiModel = await response.json();

    console.log("SmartFlow AI Model Loaded!");
    console.log("Model Accuracy:", aiModel.accuracy * 100 + "%");
    updateAIPanel();

  } catch (error) {
    console.error("AI Model Loading Error:", error);
  }
}


function predictTraffic(features, node = aiModel.tree) {
  if (node.type === "leaf") {
    return aiModel.classes[node.prediction];
  }

  const value = features[node.feature];

  if (value <= node.threshold) {
    return predictTraffic(features, node.left);
  }

  return predictTraffic(features, node.right);
}

function getTrafficCounts() {
  const counts = { N: 0, S: 0, E: 0, W: 0 };

  cars.forEach(car => {
    counts[car.direction]++;
  });

  return counts;
}


function updateAIChoice() {
  if (!aiModel) {
    updateAIPanel();
    return;
  }

  const cycle = Math.floor(elapsed / 20);

  if (cycle !== lastAICycle) {
    lastAICycle = cycle;

    const counts = getTrafficCounts();

    const features = [
      counts.N,
      counts.S,
      counts.E,
      counts.W,
      waitNS,
      waitEW
    ];

    aiPriority = predictTraffic(features);

    console.log("AI Priority:", aiPriority);
  }

  updateAIPanel();
}

function updateAIPanel() {
  const counts = getTrafficCounts();

  const priorityDisplay =
    document.getElementById("aiPriorityDisplay");

  const reason =
    document.getElementById("aiReason");

  const nsCount =
    document.getElementById("aiNSCount");

  const ewCount =
    document.getElementById("aiEWCount");

  const nsWait =
    document.getElementById("aiNSWait");

  const ewWait =
    document.getElementById("aiEWWait");

  const updated =
    document.getElementById("aiUpdated");

  if (!priorityDisplay || !reason || !nsCount ||
      !ewCount || !nsWait || !ewWait || !updated) {
    return;
  }

  if (!aiModel) {
    priorityDisplay.textContent = "Model Loading...";
    reason.textContent = "Waiting for the AI model.";
    return;
  }

  priorityDisplay.textContent = aiPriority;

  reason.textContent =
    "The AI evaluated vehicle counts and waiting times on both axes.";

  nsCount.textContent = counts.N + counts.S;
  ewCount.textContent = counts.E + counts.W;

  nsWait.textContent = waitNS.toFixed(1);
  ewWait.textContent = waitEW.toFixed(1);

  updated.textContent =
    "Last decision: Simulation at " +
    Math.floor(lastAICycle * 20) + " seconds";
}


function updateWaitingTimes() {
  const counts = getTrafficCounts();
  const state = signalState();

  if (counts.N + counts.S === 0 ||
      state === "NS_GREEN") {
    waitNS = 0;
  } else {
    waitNS += 0.03;
  }

  if (counts.E + counts.W === 0 ||
      state === "EW_GREEN") {
    waitEW = 0;
  } else {
    waitEW += 0.03;
  }
}


let cars = [];
let running = false;
let timer = null;
let elapsed = 0;
let spawnCounter = 0;
let vehiclesServed = 0;

const directions = ["N", "S", "E", "W"];

function signalState() {
  const phase = elapsed % 20;

  if (aiPriority === "North-South") {
    if (phase < 8) return "NS_GREEN";
    if (phase < 10) return "NS_YELLOW";
    if (phase < 18) return "EW_GREEN";
    return "EW_YELLOW";
  }

  if (phase < 8) return "EW_GREEN";
  if (phase < 10) return "EW_YELLOW";
  if (phase < 18) return "NS_GREEN";
  return "NS_YELLOW";
}

function updateLights() {
  const state = signalState();

  const ns = document.getElementById("lightNS");
  const ew = document.getElementById("lightEW");

  function setLight(element, color) {
    element.querySelectorAll(".lamp").forEach(lamp => {
      lamp.classList.remove("active");
      if (lamp.classList.contains(color)) {
        lamp.classList.add("active");
      }
    });
  }

  const nsColor = state.startsWith("NS") ?
    state.split("_")[1].toLowerCase() : "red";

  const ewColor = state.startsWith("EW") ?
    state.split("_")[1].toLowerCase() : "red";

  setLight(ns, nsColor);
  setLight(ew, ewColor);

  document.getElementById("nsSignal").textContent =
    "North–South: " + nsColor.toUpperCase();

  document.getElementById("ewSignal").textContent =
    "East–West: " + ewColor.toUpperCase();
}

function createCar(direction) {
  console.log("NEW CAR:", direction, "Time:", elapsed);
  const size = 360;

const positions = {
  N: { x: 154, y: -40, dx: 0, dy: 2, stop: 83 },
  S: { x: 206, y: 400, dx: 0, dy: -2, stop: 237 },
  E: { x: 400, y: 154, dx: -2, dy: 0, stop: 237 },
  W: { x: -40, y: 206, dx: 2, dy: 0, stop: 83 }
};

  const p = positions[direction];

  const car = {
    direction,
    x: p.x,
    y: p.y,
    dx: p.dx,
    dy: p.dy,
    stop: p.stop,
passedStopLine: false,
inIntersection: false,
element: document.createElement("div")
  };

  car.element.className =
    "car " +
    (direction === "N" || direction === "S"
      ? "vertical-car "
      : "horizontal-car ") +
    ({N:"north", S:"south", E:"east", W:"west"}[direction]);

  carLayer.appendChild(car.element);
  cars.push(car);
}

function canSpawn(direction) {
  return !cars.some(car => {
    if (car.direction !== direction) return false;

    if (direction === "N") return car.y < 40;
    if (direction === "S") return car.y > 320;
    if (direction === "E") return car.x > 320;
    return car.x < 40;
  });
}

function addTraffic() {
  directions.forEach(direction => {
    if (canSpawn(direction)) createCar(direction);
  });
}

function isGreen(direction) {
  const state = signalState();

  if (direction === "N" || direction === "S") {
    return state === "NS_GREEN";
  }

  return state === "EW_GREEN";
}




function moveCars() {
  const width = intersection.clientWidth;
  const scale = width / 360;

  const carLength = 36;
  const safeGap = 12;
  const minDistance = carLength + safeGap;

  // Check whether a vehicle occupies the central junction
  function occupiesJunction(car, x = car.x, y = car.y) {
    const vertical =
      car.direction === "N" || car.direction === "S";

    const carWidth = vertical ? 22 : 36;
    const carHeight = vertical ? 36 : 22;

    return (
      x < 235 &&
      x + carWidth > 125 &&
      y < 235 &&
      y + carHeight > 125
    );
  }

  // Check whether another traffic axis occupies the junction
  function conflictingVehicleInside(direction) {
    const vertical =
      direction === "N" || direction === "S";

    return cars.some(other => {
      const otherVertical =
        other.direction === "N" ||
        other.direction === "S";

      return (
        vertical !== otherVertical &&
        occupiesJunction(other)
      );
    });
  }

  // Process each lane, starting with the front vehicle
  directions.forEach(direction => {
    const laneCars = cars
      .filter(car => car.direction === direction);

    laneCars.sort((a, b) => {
      if (direction === "N") return b.y - a.y;
      if (direction === "S") return a.y - b.y;
      if (direction === "E") return a.x - b.x;
      return b.x - a.x;
    });

    let leader = null;

    laneCars.forEach(car => {
      let nextX = car.x + car.dx;
      let nextY = car.y + car.dy;

      const alreadyInside = occupiesJunction(car);

      // Do not enter on red/yellow or while
      // conflicting traffic occupies the junction
      const mustStop =
  !car.passedStopLine &&
  !alreadyInside &&
  (
    !isGreen(direction) ||
    conflictingVehicleInside(direction)
  );

      if (mustStop) {
        if (direction === "N") {
          nextY = Math.min(nextY, car.stop);
        }

        if (direction === "S") {
          nextY = Math.max(nextY, car.stop);
        }

        if (direction === "E") {
          nextX = Math.max(nextX, car.stop);
        }

        if (direction === "W") {
          nextX = Math.min(nextX, car.stop);
        }
      }

      // Maintain spacing from the vehicle ahead
      if (leader) {
        if (direction === "N") {
          nextY = Math.min(
            nextY,
            leader.y - minDistance
          );
        }

        if (direction === "S") {
          nextY = Math.max(
            nextY,
            leader.y + minDistance
          );
        }

        if (direction === "E") {
          nextX = Math.max(
            nextX,
            leader.x + minDistance
          );
        }

        if (direction === "W") {
          nextX = Math.min(
            nextX,
            leader.x - minDistance
          );
        }
      }

      car.x = nextX;
      car.y = nextY;
      // Remember when the vehicle has crossed its stop line
if (direction === "N" && car.y > car.stop) {
  car.passedStopLine = true;
}

if (direction === "S" && car.y < car.stop) {
  car.passedStopLine = true;
}

if (direction === "E" && car.x < car.stop) {
  car.passedStopLine = true;
}

if (direction === "W" && car.x > car.stop) {
  car.passedStopLine = true;
}


      car.inIntersection = occupiesJunction(car);

      car.element.style.left = (car.x * scale) + "px";
      car.element.style.top = (car.y * scale) + "px";

      car.element.style.width =
        ((direction === "N" || direction === "S" ? 22 : 36) * scale) + "px";

      car.element.style.height =
        ((direction === "N" || direction === "S" ? 36 : 22) * scale) + "px";

      leader = car;
    });
  });

  // Remove vehicles that have exited the simulation
  cars = cars.filter(car => {
    const inside = car.x > -60 && car.x < 420 &&
                   car.y > -60 && car.y < 420;

    if (!inside) {
      car.element.remove();
      vehiclesServed++;
    }

    return inside;
  });

  updateAnalytics();
}


function updateStatus() {
  const phase = signalState();

  let message = "Traffic simulation running";

  if (phase === "NS_GREEN") message += " – North/South green";
  if (phase === "NS_YELLOW") message += " – North/South yellow";
  if (phase === "EW_GREEN") message += " – East/West green";
  if (phase === "EW_YELLOW") message += " – East/West yellow";

  document.getElementById("status").textContent =
   message + " | " + Math.floor(elapsed) + " seconds";
}

function startTraffic() {
  if (running) return;

running = true;
addTraffic();
updateAIChoice();
updateLights();
  timer = setInterval(() => {
    elapsed += 0.03;
    updateWaitingTimes();
updateAIChoice();
updateAIPanel();
spawnCounter += 0.03;

if (spawnCounter >= 2) {
  directions.forEach(direction => {
    if (canSpawn(direction)) createCar(direction);
  });

  spawnCounter = 0;
}

    updateLights();
    moveCars();
    updateStatus();
  }, 30);
}

function pauseTraffic() {
  clearInterval(timer);
  timer = null;
  running = false;

  document.getElementById("status").textContent =
    "Simulation paused";
}

function resetTraffic() {
  console.trace("RESET FUNCTION WAS CALLED!");
  pauseTraffic();

  cars.forEach(car => car.element.remove());
  cars = [];
elapsed = 0;
vehiclesServed = 0;
waitNS = 0;
waitEW = 0;
lastAICycle = -1;
aiPriority = "North-South";
updateAnalytics();
updateAIPanel();

  updateLights();

  document.getElementById("status").textContent =
    "System ready";
}

updateLights();
function updateAnalytics() {
  const counts = {
    N: 0,
    S: 0,
    E: 0,
    W: 0
  };

  cars.forEach(car => {
    counts[car.direction]++;
  });

  const total = cars.length;

  document.getElementById("totalVehicles").textContent = total;

  document.getElementById("vehiclesServed").textContent =
    vehiclesServed;

  const status = document.getElementById("trafficStatus");

  if (total < 8) {
    status.textContent = "Low";
    status.style.color = "#35d49a";
  } else if (total < 16) {
    status.textContent = "Medium";
    status.style.color = "#ffd43b";
  } else {
    status.textContent = "High";
    status.style.color = "#ff6868";
  }

  ["N", "S", "E", "W"].forEach(direction => {
    document.getElementById("count" + direction).textContent =
      counts[direction];

    const percentage = Math.min(counts[direction] / 10 * 100, 100);

    document.getElementById("bar" + direction).style.width =
      percentage + "%";
  });
}
  updateAnalytics();
  loadAIModel();
