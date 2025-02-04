import { reportError } from '@gcorevideo/utils';
import assert from "assert";

export default class MergeVast {
  private firstXML: Document;
  private secondXML: Document;

  private firstVAST: HTMLCollectionOf<Element>;
  private secondVAST: HTMLCollectionOf<Element>;

  constructor(xml1: string, xml2: string) {
    this.firstXML = this._stringToXML(xml1);
    this.secondXML = this._stringToXML(xml2);
    this.firstVAST = this.firstXML.getElementsByTagName('VAST');
    this.secondVAST = this.secondXML.getElementsByTagName('VAST');
  }

  merge() {
    const res = this._mergeXML(this.firstVAST, this.secondVAST);

    try {
      return res[0].outerHTML;
    } catch (error) {
      // LogManager.exception(error);
      reportError(error);
    }

    return '';
  }

  _mergeXML(first: HTMLCollectionOf<Element>, second: HTMLCollectionOf<Element>, parent?: Element): HTMLCollectionOf<Element> {
    // const sources = [].slice.call( arguments, 0 );
    // const first = sources[0];
    // const second = sources[1];
    // const parent = sources[2];

    for (let i = 0; i < first.length; i++) {
      let secondItems = this._getPieceTree(first[i].nodeName,second);

      if (
        first[i].nodeName === 'Tracking' ||
        first[i].nodeName === 'Impression' ||
        first[i].nodeName === 'Error' ||
        first[i].nodeName === 'Viewable' ||
        first[i].nodeName === 'ClickTracking' ||
        first[i].nodeName === 'ClickThrough'
      ) {
        secondItems = null;
      }

      if (!secondItems) {
        try {
          assert(parent, 'parent is null');
          parent.appendChild(first[i].cloneNode(true));
        } catch (error) {
          // LogManager.exception(error);
          reportError(error);
        }
      } else {
        if (first[i].children.length > 0 && secondItems) {
          this._mergeXML(first[i].children, secondItems.children, secondItems );
        }
      }
    }

    return second;
  }

  _getPieceTree(nodeName: string, xml: HTMLCollectionOf<Element>): Element | null {
    if (xml) {
      if (xml instanceof HTMLCollection) {
        for (const item of xml) {
          if (item.nodeName === nodeName) {
            return item;
          }
        }
      }
    }

    return null;
  }

  _stringToXML(val: string): Document {
    let xmlDoc = null;

    if (document.implementation && (document.implementation as any).createDocument) {
      return (new DOMParser()).parseFromString(val, 'application/xml');
    } else if ('ActiveXObject' in window) {
      xmlDoc = new (window.ActiveXObject as any)('Microsoft.XMLDOM');
      xmlDoc.loadXML(val);
      return xmlDoc;
    }

    throw new Error('XML Parser not found');
  }
}
