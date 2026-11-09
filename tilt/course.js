// The course, as data. Coordinates are metres; y is up. Paths only run along X or Z.
// With the default view, -Z runs up-right on screen and -X runs up-left, so the course climbs the screen.
//
// Stage A: start, wide railed track with sharp turns, a walled narrow passage, a downhill ramp,
// a beam over the void, the tilting platform with its cube.
// Stage B: a gentle hill, a steep hill, a steep climb that needs a run-up, and a spiral down that passes
// under the climb.

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

    // ---- Stage B ----
    // 6. Off the platform's far edge onto a gentle hill (1.2 m hump)
    { type: 'path', width: 3,
      points: [[-30, -3, -76], [-30, -3, -80]] },
    { type: 'hill', start: [-30, -3, -81.5], dir: '-z', length: 12, height: 1.2 },

    // 7. Sharp left, checkpoint, then a steep hill: 2.4 m hump, about 60° at its steepest
    { type: 'path', width: 3,
      points: [[-30, -3, -95], [-34, -3, -95]] },
    { type: 'gate', pos: [-33.5, -3, -95], dir: 'x', width: 3 },
    { type: 'hill', start: [-35.5, -3, -95], dir: '-x', length: 4.4, height: 2.4 },

    // 8. Run-up, then a steep climb that curls up to about 57°: you need speed to make the 4 m
    { type: 'path', width: 3,
      points: [[-41.4, -3, -95], [-45, -3, -95], [-45, -3, -104]] },
    { type: 'hill', shape: 'rise', start: [-45, -3, -105.5], dir: '-z', length: 4, height: 4 },
    { type: 'path', width: 3,
      points: [[-45, 1, -111], [-45, 1, -116]] },
    { type: 'gate', pos: [-45, 1, -115.5], dir: 'z', width: 3 },

    // 9. The spiral: 1¾ turns down around a column, 6.3 m in all. It passes under the top of the climb,
    //    and so does the track that leaves it.
    { type: 'spiral', center: [-41, 1, -117.5], radius: 4, width: 2.4, turns: 1.75, drop: 3.6 },
    { type: 'path', width: 2.4, capEnd: true,
      points: [[-42.2, -5.3, -113.5], [-52, -5.3, -113.5], [-52, -5.3, -120]] },
    { type: 'gate', kind: 'finish', pos: [-52, -5.3, -119], dir: 'z', width: 2.4 },
  ],
};
