'use strict'

/** Region carousel uses native overflow-x; vertical wheel must not be hijacked. */
function buildHorizontalScrollWheelHelperSource() {
  return `
  function bindHorizontalWheelScroll(el, canScrollFn){
    /* Intentionally empty: native horizontal trackpad/touch scrolling; preserve vertical page scroll. */
  }
  `
}

module.exports = { buildHorizontalScrollWheelHelperSource }
