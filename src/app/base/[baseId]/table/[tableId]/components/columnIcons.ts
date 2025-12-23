export function getColumnIconName(columnType: string): string {
  switch (columnType) {
    case 'longText':
      return 'Paragraph';
    case 'user':
      return 'User';
    case 'singleSelect':
      return 'CaretCircleDown';
    case 'attachment':
      return 'File';
    case 'singleLineText':
    default:
      return 'TextAlt';
  }
}


