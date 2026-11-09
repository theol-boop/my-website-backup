// The course, as data. Coordinates are metres; y is up. Paths only run along X or Z.
// With the default view, -Z runs up-right on screen and -X runs up-left, so the course climbs the screen.
//
// Stage A: start, wide railed track with sharp turns, a walled narrow passage, a downhill ramp,
// a beam over the void, the tilting platform with its cube.
// Stage B: a gentle hill, a steep hill, a steep climb that needs a run-up, and a spiral down that passes
// under the climb.
// Stage C: arches to roll under, a loop-the-loop, a half-pipe, a humped bridge, and a funnel bowl that drops
// you through its middle onto a lower level.

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
    { type: 'path', width: 2.4,
      points: [[-42.2, -5.3, -113.5], [-52, -5.3, -113.5], [-52, -5.3, -130]] },

    // ---- Stage C ----
    // 10. A colonnade: three arches to roll under, each lower and narrower than the last
    { type: 'gate', pos: [-52, -5.3, -116], dir: 'z', width: 2.4 },
    { type: 'arch', pos: [-52, -5.3, -119], dir: '-z', span: 2.2, clearance: 2.2 },
    { type: 'arch', pos: [-52, -5.3, -123], dir: '-z', span: 1.8, clearance: 1.6 },
    { type: 'arch', pos: [-52, -5.3, -127], dir: '-z', span: 1.3, clearance: 1.15 },

    // 11. Drop 3 m for speed, straight into a loop-the-loop (it drifts 3.4 m to the left as it goes round)
    { type: 'hill', shape: 'rise', start: [-52, -5.3, -131.2], dir: '-z', length: 6, height: -3, width: 2.4 },
    { type: 'path', width: 2.4,
      points: [[-52, -8.3, -138.4], [-52, -8.3, -140.6]] },
    { type: 'loop', start: [-52, -8.3, -141.8], dir: '-z', side: '-x', radius: 2.2, width: 2.4, shift: 3.4 },

    // 12. Checkpoint, then a half-pipe
    { type: 'path', width: 2.4,
      points: [[-55.4, -8.3, -143], [-55.4, -8.3, -146]] },
    { type: 'gate', pos: [-55.4, -8.3, -145], dir: 'z', width: 2.4 },
    { type: 'halfpipe', start: [-55.4, -8.3, -147.2], dir: '-z', radius: 2.5, length: 14 },

    // 13. A humped arch bridge over a gap (thin, low rails)
    { type: 'path', width: 2.4,
      points: [[-55.4, -8.3, -162.4], [-55.4, -8.3, -166.3]] },
    { type: 'hill', start: [-55.4, -8.3, -167.5], dir: '-z', length: 7, height: 1.5, width: 2.4, thick: 0.35, railH: 0.3 },

    // 14. Sharp right, checkpoint, and into the bowl: the track runs off its end at the rim, the ball orbits
    //     down the funnel and drops through the hole onto track 3 m below, which runs out under the bowl.
    { type: 'path', width: 3, openStart: '+z',
      points: [[-55.4, -8.3, -176], [-66, -8.3, -176]] },
    { type: 'gate', pos: [-58.5, -8.3, -176], dir: 'x', width: 3 },
    { type: 'bowl', center: [-66, -8.3, -180.5], radius: 6, depth: 3, hole: 0.9, gap: [25, 105] },
    { type: 'path', width: 3, capStart: true, capEnd: true,
      points: [[-66, -14.6, -180.5], [-66, -14.6, -194]] },
    { type: 'gate', kind: 'finish', pos: [-66, -14.6, -192], dir: 'z', width: 3 },
  ],
};
