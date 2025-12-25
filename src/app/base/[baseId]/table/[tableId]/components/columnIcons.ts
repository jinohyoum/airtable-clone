export function getColumnIconName(columnType: string): string {
  switch (columnType) {
    // Text
    case 'text':
    case 'longText':
    case 'multilineText':
      return 'Paragraph';

    // User
    case 'collaborator':
    case 'user':
      return 'User';

    // Select
    case 'select':
    case 'singleSelect':
      return 'CaretCircleDown';
    case 'multiSelect':
      return 'Multiselect';

    // Attachments
    case 'multipleAttachment':
    case 'attachment':
      return 'File';

    // Common primitives
    case 'checkbox':
      return 'CheckSquare';
    case 'date':
      return 'CalendarFeature';
    case 'phone':
      return 'Phone';
    case 'email':
      return 'EnvelopeSimple';
    case 'url':
      return 'Link';
    case 'number':
      return 'HashStraight';
    case 'currency':
      return 'CurrencyDollarSimple';
    case 'percentV2':
      return 'Percent';
    case 'duration':
      return 'Clock';
    case 'rating':
      return 'Star';

    // Advanced
    case 'formula':
      return 'Formula';
    case 'rollup':
      return 'Spiral';
    case 'count':
      return 'Calculator';
    case 'lookup':
      return 'Lookup';

    // Audit
    case 'createdTime':
    case 'lastModifiedTime':
      return 'CalendarBlankLightning';
    case 'createdBy':
    case 'lastModifiedBy':
      return 'UserLightning';

    // Misc
    case 'autoNumber':
      return 'Autonumber';
    case 'barcode':
      return 'Barcode';
    case 'button':
      return 'Cursor';
    case 'foreignKey':
      return 'ArrowRightList';

    case 'singleLineText':
    default:
      return 'TextAlt';
  }
}


