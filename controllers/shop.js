const fs = require('fs');
const path = require('path');

const PDFDocument = require('pdfkit');

const Product = require('../models/product');
const Order = require('../models/order');

exports.getIndex = (req, res, next) => {
  Product.find()
    .then(products => {
      res.render('shop/index', {
        prods: products,
        pageTitle: 'Shop',
        path: '/',
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getProducts = (req, res, next) => {
  Product.find()
    .then(products => {
      res.render('shop/product-list', {
        prods: products,
        pageTitle: 'All Products',
        path: '/products',
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then(product => {
      res.render('shop/product-detail', {
        product,
        pageTitle: product.title,
        path: '/products',
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getCart = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .execPopulate()
    .then(user => {
      const products = user.cart.items;
      res.render('shop/cart', {
        pageTitle: 'Your Cart',
        path: '/cart',
        products,
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postCart = (req, res, next) => {
  const prodId = req.body.productId;
  Product.findById(prodId)
    .then(product => req.user.addToCart(product))
    .then(result => {
      console.log(result);
      res.redirect('/cart');
    });
};

exports.postCartDeleteProduct = (req, res, next) => {
  const prodId = req.body.productId;
  req.user
    .removeFromCart(prodId)
    .then(() => {
      res.redirect('/cart');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postOrder = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .execPopulate()
    .then(user => {
      const products = user.cart.items.map(i => ({
        quantity: i.quantity,
        product: { ...i.productId._doc },
      }));
      const order = new Order({
        user: {
          email: req.user.email,
          userId: req.user,
        },
        products,
      });
      return order.save();
    })
    .then(() => req.user.clearCart())
    .then(() => res.redirect('/orders'))
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getOrders = (req, res, next) => {
  Order.find({ 'user.userId': req.user._id })
    .then(orders => {
      res.render('shop/orders', {
        pageTitle: 'Your Orders',
        path: '/orders',
        orders,
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getInvoice = (req, res, next) => {
  const { orderId } = req.params;
  Order.findById(orderId)
    .then(order => {
      if (!order) {
        return next(new Error('No order found.'));
      }
      if (order.user.userId.toString() !== req.user._id.toString()) {
        return next(new Error('Unauthorized.'));
      }
      const invoiceName = `invoice-${orderId}.pdf`;
      const invoicePath = path.join(
        'data',
        'invoices',
        `invoice-${orderId}.pdf`
      );

      const pdf = new PDFDocument();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${invoiceName}"`);
      pdf.pipe(fs.createWriteStream(invoicePath));
      pdf.pipe(res);

      pdf.fontSize(26).text('Invoice');
      pdf.fontSize(16).text('--------------------------');
      let totalPrice = 0;
      order.products.forEach(prod => {
        totalPrice += prod.quantity * prod.product.price;
        pdf.text(
          `${prod.product.title} - ${prod.quantity} x ${prod.product.price}€`
        );
      });
      pdf.text('--------------------------');
      pdf
        .fontSize(20)
        .text('Total Price: ', { continued: true })
        .text(`${totalPrice}€`, { underline: true });

      pdf.end();
      // Stream chunks instead of preloading to memory.
      // fs.readFile(
      //   invoicePath,
      //   (err, data) => {
      //     if (err) {
      //       return next(err);
      //     }
      //     res.setHeader('Content-Type', 'application/pdf');
      //     res.setHeader(
      //       'Content-Disposition',
      //       `inline; filename="${invoiceName}"`
      //     );
      //     res.send(data);
      //   }
      // );

      // const file = fs.createReadStream(invoicePath);
      // file.pipe(res);
    })
    .catch(err => next(err));
};

exports.getCheckout = (req, res, next) => {
  res.render('shop/checkout', {
    pageTitle: 'Checkout',
    path: '/checkout',
  });
};
