import { BaseMail } from '@adonisjs/mail'

export default class UserInvitationNotification extends BaseMail {
  subject = 'دعوة لإنشاء حسابك'

  constructor(
    private email: string,
    public invitationUrl: string
  ) {
    super()
  }

  prepare() {
    this.message
      .to(this.email)
      .text(
        `مرحبًا،\n\nدعاك مسؤول النظام لإنشاء حسابك. افتح الرابط التالي خلال 24 ساعة واختر كلمة مرورك:\n${this.invitationUrl}\n\nالرابط للاستخدام مرة واحدة. إن لم تكن تتوقع هذه الدعوة فتجاهلها. لن يُنشأ الحساب قبل قبول الدعوة.`
      )
  }
}
