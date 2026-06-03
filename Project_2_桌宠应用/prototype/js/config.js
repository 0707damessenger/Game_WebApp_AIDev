const CONFIG = {
  pet: {
    defaultX: 400,
    defaultY: 300,
    scale: 1.0,
    rotation: 0
  },

  modules: [
    {
      id: 'human_basic',
      name: '人形基础',
      description: '基础人形骨骼模板，支持站立、行走、跳跃等动作',
      skeleton: {
        joints: {
          root: { x: 0, y: 0, angle: 0 },
          spine: { x: 0, y: -20, angle: 0, parent: 'root' },
          head: { x: 0, y: -35, angle: 0, parent: 'spine' },
          arm_L: { x: -20, y: -10, angle: 30, parent: 'spine' },
          arm_R: { x: 20, y: -10, angle: -30, parent: 'spine' },
          leg_L: { x: -12, y: 25, angle: 15, parent: 'root' },
          leg_R: { x: 12, y: 25, angle: -15, parent: 'root' }
        }
      },
      animations: {
        idle: {
          loop: true,
          duration: 2000,
          keyframes: [
            { t: 0, joints: { spine: { angle: 0 }, arm_L: { angle: 20 }, arm_R: { angle: -20 }, head: { angle: 0 } } },
            { t: 500, joints: { spine: { angle: 3 }, arm_L: { angle: 30 }, arm_R: { angle: -30 }, head: { angle: 5 } } },
            { t: 1000, joints: { spine: { angle: 0 }, arm_L: { angle: 20 }, arm_R: { angle: -20 }, head: { angle: 0 } } },
            { t: 1500, joints: { spine: { angle: -3 }, arm_L: { angle: 10 }, arm_R: { angle: -10 }, head: { angle: -5 } } },
            { t: 2000, joints: { spine: { angle: 0 }, arm_L: { angle: 20 }, arm_R: { angle: -20 }, head: { angle: 0 } } }
          ]
        },
        walk: {
          loop: true,
          duration: 500,
          keyframes: [
            { t: 0, joints: { leg_L: { angle: 20 }, leg_R: { angle: -20 }, arm_L: { angle: -30 }, arm_R: { angle: 30 } } },
            { t: 250, joints: { leg_L: { angle: -20 }, leg_R: { angle: 20 }, arm_L: { angle: 30 }, arm_R: { angle: -30 } } },
            { t: 500, joints: { leg_L: { angle: 20 }, leg_R: { angle: -20 }, arm_L: { angle: -30 }, arm_R: { angle: 30 } } }
          ]
        },
        happy: {
          loop: false,
          duration: 800,
          keyframes: [
            { t: 0, joints: { spine: { angle: 0 }, head: { angle: 0 } } },
            { t: 200, joints: { spine: { angle: 10 }, head: { angle: 15 } } },
            { t: 400, joints: { spine: { angle: -10 }, head: { angle: -15 } } },
            { t: 600, joints: { spine: { angle: 10 }, head: { angle: 15 } } },
            { t: 800, joints: { spine: { angle: 0 }, head: { angle: 0 } } }
          ]
        },
        sleep: {
          loop: true,
          duration: 4000,
          keyframes: [
            { t: 0, joints: { spine: { angle: 15 }, head: { angle: 30 }, arm_L: { angle: 40 }, arm_R: { angle: 40 } } },
            { t: 2000, joints: { spine: { angle: 18 }, head: { angle: 35 }, arm_L: { angle: 45 }, arm_R: { angle: 45 } } },
            { t: 4000, joints: { spine: { angle: 15 }, head: { angle: 30 }, arm_L: { angle: 40 }, arm_R: { angle: 40 } } }
          ]
        }
      },
      stateMachine: {
        initialState: 'idle',
        states: {
          idle: {
            animation: 'idle',
            timers: [
              { to: 'randomHappy', after: 5000, chance: 0.15 },
              { to: 'sleep', after: 15000, chance: 0.3 }
            ]
          },
          randomHappy: {
            animation: 'happy',
            oneShot: true,
            bubble: '哼~ 🎵',
            onEnd: 'idle'
          },
          walk: {
            animation: 'walk'
          },
          sleep: {
            animation: 'sleep',
            bubble: 'Zzz... 💤',
            timers: [
              { to: 'idle', after: 8000, chance: 0.5 }
            ]
          },
          dragWalk: {
            animation: 'walk'
          },
          clickHappy: {
            animation: 'happy',
            oneShot: true,
            bubble: '好开心！💕',
            onEnd: 'idle'
          }
        }
      }
    },
    {
      id: 'blob_basic',
      name: '球形基础',
      description: '简单球形骨骼模板，适合 blob 风格角色',
      skeleton: {
        joints: {
          root: { x: 0, y: 0, angle: 0 }
        }
      },
      animations: {
        idle: {
          loop: true,
          duration: 2000,
          keyframes: [
            { t: 0, joints: { root: { angle: 0 } } },
            { t: 500, joints: { root: { angle: 5 } } },
            { t: 1000, joints: { root: { angle: 0 } } },
            { t: 1500, joints: { root: { angle: -5 } } },
            { t: 2000, joints: { root: { angle: 0 } } }
          ]
        },
        walk: {
          loop: true,
          duration: 800,
          keyframes: [
            { t: 0, joints: { root: { angle: 10 } } },
            { t: 400, joints: { root: { angle: -10 } } },
            { t: 800, joints: { root: { angle: 10 } } }
          ]
        },
        happy: {
          loop: false,
          duration: 600,
          keyframes: [
            { t: 0, joints: { root: { angle: 0 } } },
            { t: 300, joints: { root: { angle: 30 } } },
            { t: 600, joints: { root: { angle: 0 } } }
          ]
        },
        sleep: {
          loop: true,
          duration: 4000,
          keyframes: [
            { t: 0, joints: { root: { angle: -5 } } },
            { t: 2000, joints: { root: { angle: 5 } } },
            { t: 4000, joints: { root: { angle: -5 } } }
          ]
        }
      },
      stateMachine: {
        initialState: 'idle',
        states: {
          idle: {
            animation: 'idle',
            timers: [
              { to: 'randomHappy', after: 6000, chance: 0.12 },
              { to: 'sleep', after: 20000, chance: 0.25 }
            ]
          },
          randomHappy: {
            animation: 'happy',
            oneShot: true,
            bubble: '咚咚~ 💫',
            onEnd: 'idle'
          },
          walk: {
            animation: 'walk'
          },
          sleep: {
            animation: 'sleep',
            bubble: 'Zzz... 💤',
            timers: [
              { to: 'idle', after: 10000, chance: 0.4 }
            ]
          },
          dragWalk: {
            animation: 'walk'
          },
          clickHappy: {
            animation: 'happy',
            oneShot: true,
            bubble: '好开心！💕',
            onEnd: 'idle'
          }
        }
      }
    }
  ],

  interaction: {
    dragThreshold: 5,
    clickDelay: 300
  },

  ai: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    apiKey: '',
    model: 'gpt-3.5-turbo',
    systemPrompt: '你是一个可爱的桌面宠物精灵，说话俏皮活泼，喜欢用颜文字和语气词。回复要简短，不超过两句话。'
  }
};

function getModuleById(id) {
  return CONFIG.modules.find(function(m) { return m.id === id; }) || CONFIG.modules[0];
}

function getDefaultModule() {
  return CONFIG.modules[0];
}