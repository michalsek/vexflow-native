import { MusicXmlParseError } from './types';

export type XmlAttributes = Record<string, string>;

export interface XmlElement {
  name: string;
  children: XmlElement[];
  attributes: XmlAttributes;
  text: string;
}

type RawXmlNode = Record<string, unknown>;

const ATTRIBUTE_NODE = ':@';
const TEXT_NODE = '#text';
const ATTRIBUTE_PREFIX = '@_';

export function normalizeOrderedXml(nodes: unknown, path = '$'): XmlElement[] {
  if (!Array.isArray(nodes)) {
    throw new MusicXmlParseError('Expected ordered XML node array', { path });
  }

  return nodes.flatMap((node, index) =>
    normalizeNode(node, `${path}[${index.toString()}]`)
  );
}

export function firstChild(element: XmlElement, name: string): XmlElement {
  const child = element.children.find((item) => item.name === name);

  if (!child) {
    throw new MusicXmlParseError(`Missing <${name}>`, {
      path: element.name,
    });
  }

  return child;
}

export function childrenNamed(element: XmlElement, name: string): XmlElement[] {
  return element.children.filter((child) => child.name === name);
}

export function optionalChild(
  element: XmlElement,
  name: string
): XmlElement | undefined {
  return element.children.find((child) => child.name === name);
}

export function hasChild(element: XmlElement, name: string): boolean {
  return element.children.some((child) => child.name === name);
}

export function textOf(element: XmlElement): string {
  return element.text.trim();
}

export function childText(
  element: XmlElement,
  name: string
): string | undefined {
  const child = optionalChild(element, name);
  return child ? textOf(child) : undefined;
}

export function requiredChildText(element: XmlElement, name: string): string {
  const value = childText(element, name);

  if (value === undefined || value === '') {
    throw new MusicXmlParseError(`Missing <${name}> text`, {
      path: element.name,
    });
  }

  return value;
}

export function attr(element: XmlElement, name: string): string | undefined {
  return element.attributes[name];
}

export function numberText(
  element: XmlElement,
  name: string
): number | undefined {
  const value = childText(element, name);
  return value === undefined || value === '' ? undefined : parseNumber(value);
}

export function requiredNumberText(element: XmlElement, name: string): number {
  const value = numberText(element, name);

  if (value === undefined) {
    throw new MusicXmlParseError(`Missing numeric <${name}>`, {
      path: element.name,
    });
  }

  return value;
}

export function parseNumber(value: string): number {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    throw new MusicXmlParseError(`Expected number, received "${value}"`);
  }

  return numeric;
}

function normalizeNode(node: unknown, path: string): XmlElement[] {
  if (!isRecord(node)) {
    throw new MusicXmlParseError('Expected XML node object', { path });
  }

  return Object.entries(node)
    .filter(([name]) => name !== ATTRIBUTE_NODE)
    .flatMap(([name, value]) => {
      if (name === TEXT_NODE) {
        return [];
      }

      return [normalizeElement(name, value, readAttributes(node), path)];
    });
}

function normalizeElement(
  name: string,
  value: unknown,
  attributes: XmlAttributes,
  path: string
): XmlElement {
  const rawChildren = Array.isArray(value) ? value : [];
  const childElements = normalizeOrderedXml(rawChildren, `${path}.${name}`);
  const text = rawChildren
    .map((child) => (isRecord(child) ? child[TEXT_NODE] : undefined))
    .filter((child): child is string | number | boolean => child !== undefined)
    .map(String)
    .join('');

  return {
    name,
    children: childElements,
    attributes,
    text,
  };
}

function readAttributes(node: RawXmlNode): XmlAttributes {
  const rawAttributes = node[ATTRIBUTE_NODE];

  if (!isRecord(rawAttributes)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(rawAttributes).map(([name, value]) => [
      name.startsWith(ATTRIBUTE_PREFIX)
        ? name.slice(ATTRIBUTE_PREFIX.length)
        : name,
      String(value),
    ])
  );
}

function isRecord(value: unknown): value is RawXmlNode {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
