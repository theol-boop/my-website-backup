// The course, as data. Coordinates are metres; y is up. Paths only run along X or Z.
// With the default view, -Z runs up-right on screen and -X runs up-left, so the course climbs the screen.
//
// Stage A: start, wide railed track with sharp turns, a walled narrow passage, a downhill ramp,
// a beam over the void, the tilting platform with its cube, and the finish.

export const COURSE = {
  spawn: [0, 0.8, 0.5],
  pieces: [
    // 1. Wide railed track with three sharp turns
    { type: 'path', width: 3, capStart: true,
      points: [[0, 0, 0], [0, 0, -10], [-8, 0, -10], [-8, 0, -16], [-14, 0, -16]] },
    { type: 'gate', kind: 'start', pos: [0, 0, -2.5], dir: 'z', width: 3 },

    // 2. Narrow walled passage: zig-zag, 1.4 m between the walls (the ball is 1 m wide)
    { type: 'path', width: 1.8, railH: 1.1,
      points: [[-16.4, 0, -16], [-21, 0, -16], [-21, 0, -22], [-25, 0, -22], [-25, 0, -28]] },

    // 3. Downhill ramp (about 21°) to the first checkpoint
    { type: 'path', width: 3,
      points: [[-25, 0, -30.4], [-25, -3, -41], [-25, -3, -44]] },
    { type: 'gate', pos: [-25, -3, -43.5], dir: 'z', width: 3 },

    // 4. The beam: 0.8 m wide, no rails, one turn, nothing underneath
    { type: 'path', width: 0.8, thick: 0.4, rails: false,
      points: [[-25, -3, -45.9], [-25, -3, -51], [-30, -3, -51], [-30, -3, -57]] },

    // 5. Landing, second checkpoint, then the tilting platform with its cube
    { type: 'path', width: 3,
      points: [[-30, -3, -58.9], [-30, -3, -62]] },
    { type: 'gate', pos: [-30, -3, -61], dir: 'z', width: 3 },
    { type: 'tiltPlatform', pos: [-30, -3, -69], size: 10, cube: [2.5, 1] },

    // 6. Off the far edge to the finish
    { type: 'path', width: 3, capEnd: true,
      points: [[-30, -3, -76], [-30, -3, -82]] },
    { type: 'gate', kind: 'finish', pos: [-30, -3, -81], dir: 'z', width: 3 },
  ],
};
