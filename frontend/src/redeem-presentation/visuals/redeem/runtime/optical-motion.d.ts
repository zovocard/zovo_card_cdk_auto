interface OpticalMotionHandle {
  resize(): void
}
declare const R45Optics: {
  mount(host: HTMLElement): OpticalMotionHandle
}
export default R45Optics
