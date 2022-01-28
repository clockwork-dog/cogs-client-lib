type NumberOfLoops = number | 'forever';

export function loopAsNumber(loop: NumberOfLoops | undefined): number {
  return loop === 'forever' ? Infinity : !loop ? 1 : loop;
}

export default NumberOfLoops;
