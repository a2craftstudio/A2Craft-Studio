/* eslint-disable @typescript-eslint/no-explicit-any */
import { Backend } from '../app/core/backend';

/**
 * Test double for the Backend. Every call returns a harmless default, so components and services can be tested in isolation.
 * Override behaviour per test with backend.on("listProducts", async () => [...]) and inspect backend.calls.
 * The real behaviour (pricing, payments, permissions) lives in the Node server and is tested there.
 */
export class TestBackend extends Backend {
  calls: { name: string; args: unknown[] }[] = [];
  private handlers: Record<string, (...args: any[]) => unknown> = {};

  on(name: string, fn: (...args: any[]) => unknown) { this.handlers[name] = fn; return this; }
  called(name: string) { return this.calls.filter((c) => c.name === name); }

  private async run(name: string, args: any[], fallback: () => unknown): Promise<any> {
    this.calls.push({ name, args });
    const h = this.handlers[name];
    return h ? h(...args) : fallback();
  }

  signedInAs(user: { id?: string; email: string; name?: string; role?: 'customer' | 'admin' }) {
    this.session.set({ id: user.id ?? 'u1', email: user.email, name: user.name ?? '', role: user.role ?? 'customer' });
    return this;
  }
  init(...args: any[]): Promise<any> { return this.run('init', args, () => undefined); }
  signUp(...args: any[]): Promise<any> { return this.run('signUp', args, () => { this.signedInAs({ name: String(args[0]), email: String(args[1]) }); return { needsConfirmation: false }; }); }
  signIn(...args: any[]): Promise<any> { return this.run('signIn', args, () => { this.signedInAs({ email: String(args[0]) }); }); }
  signOut(...args: any[]): Promise<any> { return this.run('signOut', args, () => { this.session.set(null); }); }
  resetPassword(...args: any[]): Promise<any> { return this.run('resetPassword', args, () => undefined); }
  completePasswordReset(...args: any[]): Promise<any> { return this.run('completePasswordReset', args, () => undefined); }
  updateProfile(...args: any[]): Promise<any> { return this.run('updateProfile', args, () => undefined); }
  changePassword(...args: any[]): Promise<any> { return this.run('changePassword', args, () => undefined); }
  listProducts(...args: any[]): Promise<any> { return this.run('listProducts', args, () => []); }
  saveProduct(...args: any[]): Promise<any> { return this.run('saveProduct', args, () => undefined); }
  listPortfolio(...args: any[]): Promise<any> { return this.run('listPortfolio', args, () => []); }
  savePortfolio(...args: any[]): Promise<any> { return this.run('savePortfolio', args, () => undefined); }
  setProductFile(...args: any[]): Promise<any> { return this.run('setProductFile', args, () => undefined); }
  uploadAsset(...args: any[]): Promise<any> { return this.run('uploadAsset', args, () => '/media/test.jpg'); }
  quote(...args: any[]): Promise<any> { return this.run('quote', args, () => ({ lines: [], subtotal: 0, discount: 0, total: 0 })); }
  createOrder(...args: any[]): Promise<any> { return this.run('createOrder', args, () => ({ provider: 'simulator', orderId: 'o1' })); }
  verifyPayment(...args: any[]): Promise<any> { return this.run('verifyPayment', args, () => undefined); }
  getOrder(...args: any[]): Promise<any> { return this.run('getOrder', args, () => null); }
  listMyOrders(...args: any[]): Promise<any> { return this.run('listMyOrders', args, () => []); }
  listAllOrders(...args: any[]): Promise<any> { return this.run('listAllOrders', args, () => []); }
  updateOrderStatus(...args: any[]): Promise<any> { return this.run('updateOrderStatus', args, () => undefined); }
  getDownloadUrl(...args: any[]): Promise<any> { return this.run('getDownloadUrl', args, () => '/files/test'); }
  submitInquiry(...args: any[]): Promise<any> { return this.run('submitInquiry', args, () => 'INQ-TEST01'); }
  listMyInquiries(...args: any[]): Promise<any> { return this.run('listMyInquiries', args, () => []); }
  listAllInquiries(...args: any[]): Promise<any> { return this.run('listAllInquiries', args, () => []); }
  updateInquiryStatus(...args: any[]): Promise<any> { return this.run('updateInquiryStatus', args, () => undefined); }
  uploadDeliverable(...args: any[]): Promise<any> { return this.run('uploadDeliverable', args, () => undefined); }
  resolveUpload(...args: any[]): Promise<any> { return this.run('resolveUpload', args, () => args[0] as string); }
  listReviews(...args: any[]): Promise<any> { return this.run('listReviews', args, () => []); }
  listAllReviews(...args: any[]): Promise<any> { return this.run('listAllReviews', args, () => []); }
  canReview(...args: any[]): Promise<any> { return this.run('canReview', args, () => false); }
  submitReview(...args: any[]): Promise<any> { return this.run('submitReview', args, () => undefined); }
  moderateReview(...args: any[]): Promise<any> { return this.run('moderateReview', args, () => undefined); }
  listCoupons(...args: any[]): Promise<any> { return this.run('listCoupons', args, () => []); }
  saveCoupon(...args: any[]): Promise<any> { return this.run('saveCoupon', args, () => undefined); }
  deleteCoupon(...args: any[]): Promise<any> { return this.run('deleteCoupon', args, () => undefined); }
  listCustomers(...args: any[]): Promise<any> { return this.run('listCustomers', args, () => []); }
  setUserRole(...args: any[]): Promise<any> { return this.run('setUserRole', args, () => undefined); }
  getSettings(...args: any[]): Promise<any> { return this.run('getSettings', args, () => ({ announcement: '', whatsapp: '', supportEmail: '' })); }
  saveSettings(...args: any[]): Promise<any> { return this.run('saveSettings', args, () => undefined); }
  submitContact(...args: any[]): Promise<any> { return this.run('submitContact', args, () => undefined); }
  listContacts(...args: any[]): Promise<any> { return this.run('listContacts', args, () => []); }
  updateContactStatus(...args: any[]): Promise<any> { return this.run('updateContactStatus', args, () => undefined); }
  trackEvent(...args: any[]): Promise<any> { return this.run('trackEvent', args, () => undefined); }
  listEvents(...args: any[]): Promise<any> { return this.run('listEvents', args, () => []); }
  updateOrderNote(...args: any[]): Promise<any> { return this.run('updateOrderNote', args, () => undefined); }
  updateInquiryNote(...args: any[]): Promise<any> { return this.run('updateInquiryNote', args, () => undefined); }
  deletePortfolio(...args: any[]): Promise<any> { return this.run('deletePortfolio', args, () => undefined); }
  listCategories(...args: any[]): Promise<any> { return this.run('listCategories', args, () => []); }
  saveCategory(...args: any[]): Promise<any> { return this.run('saveCategory', args, () => undefined); }
  deleteCategory(...args: any[]): Promise<any> { return this.run('deleteCategory', args, () => undefined); }
  reorderCategories(...args: any[]): Promise<any> { return this.run('reorderCategories', args, () => undefined); }
  listSubscribers(...args: any[]): Promise<any> { return this.run('listSubscribers', args, () => []); }
  removeSubscriber(...args: any[]): Promise<any> { return this.run('removeSubscriber', args, () => undefined); }
  submitCallback(...args: any[]): Promise<any> { return this.run('submitCallback', args, () => undefined); }
  listCallbacks(...args: any[]): Promise<any> { return this.run('listCallbacks', args, () => []); }
  updateCallback(...args: any[]): Promise<any> { return this.run('updateCallback', args, () => undefined); }
  subscribeNewsletter(...args: any[]): Promise<any> { return this.run('subscribeNewsletter', args, () => undefined); }
  listFavorites(...args: any[]): Promise<any> { return this.run('listFavorites', args, () => []); }
  setFavorite(...args: any[]): Promise<any> { return this.run('setFavorite', args, () => undefined); }
}
