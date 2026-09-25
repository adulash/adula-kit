/*
|--------------------------------------------------------------------------
| Validator file
|--------------------------------------------------------------------------
|
| The validator file is used for configuring global transforms for VineJS.
| The transform below converts all VineJS date outputs from JavaScript
| Date objects to Luxon DateTime instances, so that validated dates are
| ready to use with Lucid models and other parts of the app that expect
| Luxon DateTime.
|
*/

import { DateTime } from 'luxon'
import vine, { SimpleMessagesProvider, VineDate } from '@vinejs/vine'

declare module '@vinejs/vine/types' {
  interface VineGlobalTransforms {
    date: DateTime
  }
}

VineDate.transform((value) => DateTime.fromJSDate(value))

/**
 * Arabic validation messages and field names shown to users.
 */
vine.messagesProvider = new SimpleMessagesProvider(
  {
    'required': 'حقل {{ field }} مطلوب',
    'string': 'حقل {{ field }} يجب أن يكون نصاً',
    'email': 'صيغة البريد الإلكتروني غير صحيحة',
    'minLength': 'حقل {{ field }} يجب ألا يقل عن {{ min }} أحرف',
    'maxLength': 'حقل {{ field }} يجب ألا يزيد عن {{ max }} حرفاً',
    'regex': 'صيغة {{ field }} غير صحيحة',
    'enum': 'قيمة {{ field }} غير مسموحة',
    'number': 'حقل {{ field }} يجب أن يكون رقماً',
    'database.unique': 'قيمة {{ field }} مستخدمة مسبقاً',
    'confirmed': 'تأكيد {{ field }} غير مطابق',
  },
  {
    name: 'الاسم',
    email: 'البريد الإلكتروني',
    phone: 'الهاتف',
    address: 'العنوان',
    password: 'كلمة المرور',
    fullName: 'الاسم الكامل',
  }
)
