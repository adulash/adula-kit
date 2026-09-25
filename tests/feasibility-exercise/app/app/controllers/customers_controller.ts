import Customer from '#models/customer'
import { customerPolicy } from '#policies/customer_policy'
import CustomerTransformer from '#transformers/customer_transformer'
import { customerListValidator, customerValidator } from '#validators/customer'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'

const PER_PAGE = 20

/**
 * Escapes LIKE wildcards so user input is matched literally.
 */
function likePattern(term: string) {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
}

export default class CustomersController {
  /**
   * Loads an active customer visible to the current user. Customers from other
   * units and soft-deleted customers are reported as 404 so their existence
   * does not leak.
   */
  private async findVisible({ auth, params }: HttpContext) {
    const user = auth.getUserOrFail()
    const customer = await Customer.active()
      .where('id', Number(params.id) || 0)
      .first()
    if (!customer || !customerPolicy.view(user, customer)) {
      return null
    }
    return customer
  }

  async index(ctx: HttpContext) {
    const { auth, request, inertia, response } = ctx
    const user = auth.getUserOrFail()
    if (!customerPolicy.viewAny(user)) {
      return response.forbidden('غير مصرح لك بعرض العملاء')
    }

    const filters = await customerListValidator.validate(request.qs())
    const sort = filters.sort ?? 'name'
    const order = filters.order ?? 'asc'
    const search = filters.search ?? ''

    const query = Customer.active().where('unit_id', user.unitId!)
    if (search) {
      const pattern = likePattern(search)
      query.where((q) => {
        q.whereILike('name', pattern).orWhereILike('email', pattern).orWhereILike('phone', pattern)
      })
    }
    query.orderBy(sort, order).orderBy('id', 'asc')

    const paginator = await query.paginate(filters.page ?? 1, PER_PAGE)

    return inertia.render('customers/index', {
      customers: CustomerTransformer.paginate(paginator.all(), paginator.getMeta()),
      filters: { search, sort, order },
      can: { create: customerPolicy.create(user) },
    })
  }

  async create({ auth, inertia, response }: HttpContext) {
    if (!customerPolicy.create(auth.getUserOrFail())) {
      return response.forbidden('غير مصرح لك بإضافة عملاء')
    }
    return inertia.render('customers/create', {})
  }

  async store({ auth, request, response, session }: HttpContext) {
    const user = auth.getUserOrFail()
    if (!customerPolicy.create(user)) {
      return response.forbidden('غير مصرح لك بإضافة عملاء')
    }
    const payload = await request.validateUsing(customerValidator, { meta: {} })
    const customer = await Customer.create({
      ...payload,
      unitId: user.unitId!,
      createdBy: user.id,
      updatedBy: user.id,
    })
    session.flash('success', 'تمت إضافة العميل')
    return response.redirect().toRoute('customers.show', { id: customer.id })
  }

  async show(ctx: HttpContext) {
    const customer = await this.findVisible(ctx)
    if (!customer) {
      return ctx.response.notFound('العميل غير موجود')
    }
    const user = ctx.auth.getUserOrFail()
    return ctx.inertia.render('customers/show', {
      customer: CustomerTransformer.transform(customer),
      can: {
        update: customerPolicy.update(user, customer),
        delete: customerPolicy.delete(user, customer),
      },
    })
  }

  async edit(ctx: HttpContext) {
    const customer = await this.findVisible(ctx)
    if (!customer) {
      return ctx.response.notFound('العميل غير موجود')
    }
    if (!customerPolicy.update(ctx.auth.getUserOrFail(), customer)) {
      return ctx.response.forbidden('غير مصرح لك بتعديل العملاء')
    }
    return ctx.inertia.render('customers/edit', {
      customer: CustomerTransformer.transform(customer),
    })
  }

  async update(ctx: HttpContext) {
    const { request, response, session } = ctx
    const customer = await this.findVisible(ctx)
    if (!customer) {
      return response.notFound('العميل غير موجود')
    }
    const user = ctx.auth.getUserOrFail()
    if (!customerPolicy.update(user, customer)) {
      return response.forbidden('غير مصرح لك بتعديل العملاء')
    }
    const payload = await request.validateUsing(customerValidator, {
      meta: { customerId: customer.id },
    })
    customer.merge({
      name: payload.name,
      email: payload.email ?? null,
      phone: payload.phone ?? null,
      address: payload.address ?? null,
      updatedBy: user.id,
    })
    await customer.save()
    session.flash('success', 'تم حفظ التعديلات')
    return response.redirect().toRoute('customers.show', { id: customer.id })
  }

  async destroy(ctx: HttpContext) {
    const { response, session } = ctx
    const customer = await this.findVisible(ctx)
    if (!customer) {
      return response.notFound('العميل غير موجود')
    }
    const user = ctx.auth.getUserOrFail()
    if (!customerPolicy.delete(user, customer)) {
      return response.forbidden('غير مصرح لك بحذف العملاء')
    }
    customer.merge({ deletedAt: DateTime.now(), deletedBy: user.id })
    await customer.save()
    session.flash('success', 'تم حذف العميل')
    return response.redirect().toRoute('customers.index')
  }
}
