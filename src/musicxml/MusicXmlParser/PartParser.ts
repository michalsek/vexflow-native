import type { Staff, StaffGroup } from '../../state';
import type { PartInfo, ParserState, StaffBuild } from './InternalTypes';
import { parseMeasure } from './MeasureParser';
import {
  firstChild,
  numberText,
  optionalChild,
  type XmlElement,
} from './XmlOrder';

export function parsePart(
  part: XmlElement,
  partInfo: PartInfo,
  orderOffset: number,
  state: ParserState
): { staves: Staff[]; staffGroups: StaffGroup[] } {
  const firstMeasure = firstChild(part, 'measure');
  const staffCount = getStaffCount(firstMeasure);
  const builds = Array.from(
    { length: staffCount },
    (_, index): StaffBuild => ({
      id: `${partInfo.id}-staff-${(index + 1).toString()}`,
      name:
        staffCount === 1
          ? partInfo.name
          : `${partInfo.name ?? partInfo.id} ${index + 1}`,
      order: orderOffset + index,
      measures: [],
    })
  );

  part.children
    .filter((child) => child.name === 'measure')
    .forEach((measure, measureIndex) => {
      parseMeasure(measure, measureIndex, builds, state);
    });

  const staves = builds.map(
    (staff): Staff => ({
      id: staff.id,
      name: staff.name,
      order: staff.order,
      defaultClef:
        staff.defaultClef ?? (staff.order % 2 === 0 ? 'treble' : 'bass'),
      measures: staff.measures,
    })
  );

  return {
    staves,
    staffGroups:
      staves.length > 1
        ? [
            {
              id: `${partInfo.id}-group`,
              role: 'grandStaff',
              symbol: 'brace',
              staffIds: staves.map((staff) => staff.id),
            },
          ]
        : [],
  };
}

function getStaffCount(measure: XmlElement): number {
  const attributes = optionalChild(measure, 'attributes');
  const staves = attributes ? numberText(attributes, 'staves') : undefined;
  return staves ? Math.max(1, staves) : 1;
}
