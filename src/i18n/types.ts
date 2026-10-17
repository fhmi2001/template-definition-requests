/** قيمة متغير في الرسالة. القائمة تُضم بفاصل اللغة، وعناصرها التي هي مفاتيح تُترجم. */
export type ParamValue = string | number | readonly ParamValue[];
export type Params = Record<string, ParamValue>;
/** نص فيه {متغيرات}، أو دالة للحالات التي تتغير فيها الصياغة بالعدد. */
export type Entry = string | ((p: Params) => string);
