import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5ff);
scene.fog = new THREE.Fog(0x87b5ff, 25, 120);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 300);
camera.position.set(0, 2, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xffffff, 0x334455, 0.9);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(30, 40, 20);
sun.castShadow = true;
scene.add(sun);

const groundGeo = new THREE.PlaneGeometry(300, 300);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x2a5b2a });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

for (let i = 0; i < 80; i += 1) {
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(3, 3 + Math.random() * 6, 3),
    new THREE.MeshStandardMaterial({ color: 0x777777 + Math.random() * 0x666666 })
  );
  box.position.set((Math.random() - 0.5) * 220, box.geometry.parameters.height / 2, (Math.random() - 0.5) * 220);
  box.castShadow = true;
  box.receiveShadow = true;
  scene.add(box);
}

const player = {
  position: new THREE.Vector3(0, 1.7, 10),
  velocity: new THREE.Vector3(),
  yaw: 0,
  pitch: 0,
  speed: 13,
  health: 100,
  ammo: 30,
  score: 0,
  grounded: true,
};

const maxAmmo = 30;
let reloading = false;

const keys = new Set();
const healthEl = document.getElementById("health");
const ammoEl = document.getElementById("ammo");
const scoreEl = document.getElementById("score");
const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("startBtn");

let pointerLocked = false;
let gameRunning = false;
let hasActiveRound = false;

const raycaster = new THREE.Raycaster();
const tmpDir = new THREE.Vector3();

const enemies = [];
let spawnTimer = 0;

function updateHud() {
  healthEl.textContent = Math.max(0, Math.floor(player.health));
  ammoEl.textContent = reloading ? "..." : player.ammo;
  scoreEl.textContent = player.score;
}

function showOverlay(text) {
  overlay.classList.remove("hidden");
  overlay.querySelector("h1").textContent = text;
}

function getForwardVector() {
  camera.getWorldDirection(tmpDir);
  tmpDir.y = 0;
  tmpDir.normalize();
  return tmpDir;
}

function getSideVector() {
  camera.getWorldDirection(tmpDir);
  tmpDir.y = 0;
  tmpDir.normalize();
  tmpDir.cross(camera.up);
  return tmpDir;
}

function spawnEnemy() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xb22222 });
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.7, 1.4, 4, 8), mat);
  const angle = Math.random() * Math.PI * 2;
  const radius = 35 + Math.random() * 40;
  mesh.position.set(Math.cos(angle) * radius, 1.2, Math.sin(angle) * radius + player.position.z * 0.3);
  mesh.castShadow = true;
  scene.add(mesh);

  enemies.push({ mesh, speed: 2 + Math.random() * 1.5, hp: 35 });
}

function shoot() {
  if (!gameRunning || reloading || player.ammo <= 0) {
    return;
  }

  player.ammo -= 1;

  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hit = raycaster.intersectObjects(enemies.map((e) => e.mesh), false)[0];

  if (hit) {
    const enemy = enemies.find((e) => e.mesh === hit.object);
    if (enemy) {
      enemy.hp -= 20;
      enemy.mesh.material.color.set(0xff4444);
      setTimeout(() => {
        if (enemy.mesh.material) {
          enemy.mesh.material.color.set(0xb22222);
        }
      }, 80);

      if (enemy.hp <= 0) {
        scene.remove(enemy.mesh);
        enemies.splice(enemies.indexOf(enemy), 1);
        player.score += 10;
      }
    }
  }

  updateHud();
}

function reload() {
  if (reloading || player.ammo === maxAmmo || !gameRunning) {
    return;
  }
  reloading = true;
  updateHud();

  setTimeout(() => {
    player.ammo = maxAmmo;
    reloading = false;
    updateHud();
  }, 1200);
}

function damagePlayer(amount) {
  player.health -= amount;
  updateHud();

  if (player.health <= 0) {
    gameRunning = false;
    hasActiveRound = false;
    document.exitPointerLock?.();
    showOverlay("Game Over");
    overlay.querySelector("p").textContent = `Final score: ${player.score}`;
    startBtn.textContent = "Restart";
  }
}

function resetGame() {
  enemies.forEach((e) => scene.remove(e.mesh));
  enemies.length = 0;

  player.position.set(0, 1.7, 10);
  player.velocity.set(0, 0, 0);
  player.health = 100;
  player.ammo = maxAmmo;
  player.score = 0;
  player.yaw = 0;
  player.pitch = 0;

  spawnTimer = 1.5;
  gameRunning = true;
  hasActiveRound = true;
  reloading = false;
  updateHud();

  overlay.classList.add("hidden");
}

startBtn.addEventListener("click", async () => {
  if (!hasActiveRound) {
    resetGame();
  } else {
    gameRunning = true;
    overlay.classList.add("hidden");
  }

  try {
    await renderer.domElement.requestPointerLock();
  } catch (_err) {
    // Pointer lock is optional; game should still start from button press.
  }
});

document.addEventListener("pointerlockchange", () => {
  const wasPointerLocked = pointerLocked;
  pointerLocked = document.pointerLockElement === renderer.domElement;

  if (pointerLocked) {
    return;
  }

  if (wasPointerLocked && gameRunning) {
    showOverlay("Paused");
    overlay.querySelector("p").textContent = "Click start to resume.";
    startBtn.textContent = "Resume";
    gameRunning = false;
  }
});

window.addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (e.code === "KeyR") {
    reload();
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("mousedown", (e) => {
  if (e.button === 0) {
    shoot();
  }
});

window.addEventListener("mousemove", (e) => {
  if (!pointerLocked || !gameRunning) {
    return;
  }

  player.yaw -= e.movementX * 0.002;
  player.pitch -= e.movementY * 0.002;
  player.pitch = Math.max(-1.4, Math.min(1.4, player.pitch));
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();

function animate() {
  const dt = Math.min(0.033, clock.getDelta());

  if (gameRunning) {
    spawnTimer -= dt;
    if (spawnTimer <= 0 && enemies.length < 12) {
      spawnEnemy();
      spawnTimer = 0.8 + Math.random() * 1.6;
    }

    player.velocity.set(0, 0, 0);
    const forward = getForwardVector();
    const side = getSideVector();

    if (keys.has("KeyW")) player.velocity.add(forward);
    if (keys.has("KeyS")) player.velocity.sub(forward);
    if (keys.has("KeyA")) player.velocity.sub(side);
    if (keys.has("KeyD")) player.velocity.add(side);

    if (player.velocity.lengthSq() > 0) {
      player.velocity.normalize().multiplyScalar(player.speed * dt);
      player.position.add(player.velocity);
    }

    camera.position.copy(player.position);
    camera.rotation.order = "YXZ";
    camera.rotation.y = player.yaw;
    camera.rotation.x = player.pitch;

    for (const enemy of enemies) {
      const toPlayer = new THREE.Vector3().subVectors(player.position, enemy.mesh.position);
      const dist = toPlayer.length();
      toPlayer.normalize();
      enemy.mesh.position.addScaledVector(toPlayer, enemy.speed * dt);

      enemy.mesh.lookAt(player.position.x, enemy.mesh.position.y, player.position.z);

      if (dist < 1.8) {
        damagePlayer(20 * dt);
      }
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

updateHud();
animate();
