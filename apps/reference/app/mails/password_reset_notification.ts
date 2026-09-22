import { BaseMail } from '@adonisjs/mail'

/** Recovery e-mail carrying the single-use reset link (valid for one hour). */
export default class PasswordResetNotification extends BaseMail {
  subject = 'إعادة تعيين كلمة المرور'

  constructor(
    private user: { email: string; fullName: string | null },
    public resetUrl: string
  ) {
    super()
  }

  prepare() {
    const greeting = this.user.fullName ? `مرحباً ${this.user.fullName}،` : 'مرحباً،'
    this.message
      .to(this.user.email)
      .html(
        `<div dir="rtl" style="font-family: system-ui, sans-serif; line-height: 1.8">
  <p>${greeting}</p>
  <p>وصلنا طلب لإعادة تعيين كلمة مرور حسابك. اضغط الرابط التالي خلال ساعة واحدة لاختيار كلمة مرور جديدة:</p>
  <p><a href="${this.resetUrl}">${this.resetUrl}</a></p>
  <p>إن لم تطلب ذلك فتجاهل هذه الرسالة؛ كلمة مرورك لن تتغير.</p>
</div>`
      )
      .text(
        `${greeting}\n\nوصلنا طلب لإعادة تعيين كلمة مرور حسابك. افتح الرابط التالي خلال ساعة واحدة لاختيار كلمة مرور جديدة:\n${this.resetUrl}\n\nإن لم تطلب ذلك فتجاهل هذه الرسالة؛ كلمة مرورك لن تتغير.`
      )
  }
}
