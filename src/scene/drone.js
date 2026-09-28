import * as THREE from 'three';

// Loosely a DJI Matrice 4E: long folding body, front arms high and rear arms low,
// a three-lens gimbal under the nose, and an RTK puck on top. Forward is -z.
export function buildDrone() {
  const drone = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.55, metalness: 0.15 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.7, metalness: 0.1 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.4, metalness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0b1320, roughness: 0.05, metalness: 0.9, emissive: 0x0a1a33, emissiveIntensity: 0.6 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.5, 6, 16), shell);
  body.rotation.x = Math.PI / 2;
  body.scale.set(1.35, 1, 0.6);
  drone.add(body);

  // Forward and downward vision sensors.
  for (const x of [-0.2, 0.2]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.04), glass);
    eye.position.set(x, 0.06, -1.14);
    drone.add(eye);
  }

  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 1.3), dark);
  spine.position.set(0, 0.25, 0.1);
  drone.add(spine);

  const rtk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.14, 20), trim);
  rtk.position.set(0, 0.34, 0.25);
  drone.add(rtk);
  const rtkMast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 8), dark);
  rtkMast.position.set(0, 0.27, 0.25);
  drone.add(rtkMast);

  const rotors = [];
  const armGeo = new THREE.BoxGeometry(0.16, 0.1, 1.25);
  const motorGeo = new THREE.CylinderGeometry(0.17, 0.2, 0.22, 16);
  const discGeo = new THREE.CircleGeometry(0.95, 40);
  discGeo.rotateX(-Math.PI / 2);
  const bladeGeo = new THREE.BoxGeometry(1.8, 0.02, 0.12);

  // [side, front?, sweep angle from the body axis, arm height]
  for (const [side, front, angle, y] of [
    [1, true, 0.75, 0.08], [-1, true, 0.75, 0.08],
    [1, false, 0.85, -0.12], [-1, false, 0.85, -0.12],
  ]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.45, y, front ? -0.55 : 0.6);
    arm.rotation.y = -side * (front ? angle : Math.PI - angle);
    const bar = new THREE.Mesh(armGeo, dark);
    bar.position.z = -0.62;
    arm.add(bar);
    const motor = new THREE.Mesh(motorGeo, dark);
    motor.position.set(0, 0.14, -1.25);
    arm.add(motor);
    const hub = new THREE.Group();
    hub.position.set(0, 0.28, -1.25);
    const disc = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({
      color: 0xd8dde3, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false,
    }));
    const blade = new THREE.Mesh(bladeGeo, new THREE.MeshBasicMaterial({ color: 0x15161a, transparent: true, opacity: 0.55 }));
    hub.add(disc, blade);
    hub.userData.dir = side * (front ? 1 : -1);
    arm.add(hub);
    rotors.push(hub);
    drone.add(arm);
  }

  const mount = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.3), dark);
  mount.position.set(0, -0.3, -0.8);
  drone.add(mount);
  const gimbal = new THREE.Group();
  gimbal.position.set(0, -0.52, -0.8);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.36, 0.36), shell);
  gimbal.add(head);
  // Wide, tele, and laser rangefinder on the front face.
  for (const [x, y, r] of [[-0.13, 0.04, 0.09], [0.13, 0.04, 0.075], [0, -0.1, 0.035]]) {
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.05, 20), glass);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(x, y, -0.19);
    gimbal.add(lens);
  }
  // Survey pitch: camera looking straight down.
  gimbal.rotation.x = -Math.PI / 2 + 0.05;
  drone.add(gimbal);

  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  beacon.position.set(0, 0.22, 1.05);
  const navL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
  navL.position.set(-0.42, 0.05, -0.95);
  const navR = navL.clone();
  navR.material = new THREE.MeshBasicMaterial({ color: 0x34c759 });
  navR.position.x = 0.42;
  drone.add(beacon, navL, navR);

  drone.userData = { rotors, beacon };
  return drone;
}

export function animateDrone(drone, t) {
  for (const hub of drone.userData.rotors) hub.rotation.y = t * 55 * hub.userData.dir;
  drone.userData.beacon.visible = (t % 1.2) < 0.08;
}
