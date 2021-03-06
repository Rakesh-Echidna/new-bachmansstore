angular.module('orderCloud')

    .config(CartConfig)
    .controller('CartCtrl', CartController)
    .controller('MiniCartCtrl', MiniCartController)
    .controller('ProductRequestCtrl', ProductRequestController)
    .controller('ChangeRecipientPopupCtrl', ChangeRecipientPopupController)
    .directive('ordercloudMinicart', OrderCloudMiniCartDirective)
    .controller('EditRecipientPopupCtrl', EditRecipientPopupController)
    .controller('editCartPopupCtrl', editCartPopupController)

    ;

function CartConfig($stateProvider) {
    $stateProvider
        .state('cart', {
            parent: 'base',
            //data: {componentName: 'Cart'},
            url: '/cart',
            templateUrl: 'cart/templates/cart.tpl.html',
            controller: 'CartCtrl',
            controllerAs: 'cart',
            params: {
                ID: null
            },
            resolve: {
                Order: function ($rootScope, $q, $state, toastr, CurrentOrder, OrderCloud, TaxService) {
                    var dfd = $q.defer();
                    CurrentOrder.GetID()
                        .then(function (orderID) {
                            TaxService.GetTax(orderID)
                                .then(function () {
                                    OrderCloud.Orders.Get(orderID)
                                        .then(function (order) {
                                            dfd.resolve(order);
                                        });
                                });
                        })
                        .catch(function () {
                            dfd.resolve(null);
                        });
                    return dfd.promise;
                },/*
                CurrentOrderResolve: function(Order, $state) {
                    if (!Order) {
                        $state.go('home');
                    }
                },*/
                LineItemsList: function ($q, $state, Order, Underscore, OrderCloud, toastr, LineItemHelpers) {
                    var dfd = $q.defer();
                    if (Order) {
                        OrderCloud.LineItems.List(Order.ID)
                            .then(function (data) {
                                if (!data.Items.length) {
                                    toastr.error("Your order does not contain any line items.", 'Error');
                                    if ($state.current.name === 'cart') {
                                        $state.go('home');
                                    }
                                    dfd.reject();
                                }
                                else {
                                    LineItemHelpers.GetProductInfo(data.Items)
                                        .then(function () {
                                            dfd.resolve(data);
                                        });
                                }
                            })
                            .catch(function () {
                                toastr.error("Your order does not contain any line items.", 'Error');
                                dfd.reject();
                            });
                    }
                    else {
                        toastr.error("Your order does not contain any line items.", 'Error');
                        dfd.resolve(0);
                        if ($state.current.name === 'cart') {
                            $state.go('home');
                        }

                    }

                    return dfd.promise;
                },
                LoggedinUser: function (OrderCloud, $q) {
                    var deferred = $q.defer();
                    OrderCloud.Me.Get().then(function (res) {
                        console.log(res);
                        deferred.resolve(res);
                    })
                    return deferred.promise;
                }
            }
        });
}

function CartController($q, $uibModal, $rootScope, $timeout, $scope, $state, OrderCloud, Order, LineItemHelpers, LineItemsList, LoggedinUser, PdpService, CurrentOrder, $cookieStore) {
    var vm = this;
    vm.order = Order;
    vm.lineItems = LineItemsList;
    vm.removeItem = removeItem;
    vm.pagingfunction = PagingFunction;
    vm.signnedinuser = LoggedinUser;
    vm.editrecipient = editrecipient;
    vm.updateRecipientDetails = updateRecipientDetails;
    vm.getCityState = getCityState;
    vm.checkLineItemsAddress = checkLineItemsAddress;
    vm.changeDeliveryDate = changeDeliveryDate;
    vm.changerecipientpopup = changerecipientpopup;
    vm.editrecipientpopup = editrecipientpopup;
    vm.changeRecipientfun = changeRecipientfun;
    vm.changeQuantity = changeQuantity;
    vm.isLoggedIn = $cookieStore.get('isLoggedIn');

    vm.changeDate = changeDate;
    console.log(vm.order);
    vm.updateQuantity = function (cartOrder, lineItem) {
        $timeout.cancel();
        $timeout(function () {
            LineItemHelpers.UpdateQuantity(cartOrder, lineItem);
        }, 800);
    };

    function PagingFunction() {
        var dfd = $q.defer();
        if (vm.lineItems.Meta.Page < vm.lineItems.Meta.TotalPages) {
            OrderCloud.LineItems.List(vm.order.ID, vm.lineItems.Meta.Page + 1, vm.lineItems.Meta.PageSize)
                .then(function (data) {
                    vm.lineItems.Meta = data.Meta;
                    vm.lineItems.Items = [].concat(vm.lineItems.Items, data.Items);
                    LineItemHelpers.GetProductInfo(vm.lineItems.Items)
                        .then(function () {
                            dfd.resolve(vm.lineItems);
                        });
                });
        }
        else dfd.reject();
        return dfd.promise;
    }

    $rootScope.$on('OC:UpdateOrder', function (event, OrderID) {
        OrderCloud.Orders.Get(OrderID)
            .then(function (data) {
                vm.order = data;
            });
    });

    $rootScope.$on('OC:UpdateLineItem', function (event, Order) {
        OrderCloud.LineItems.List(Order.ID)
            .then(function (data) {
                LineItemHelpers.GetProductInfo(data.Items)
                    .then(function () {


                        vm.lineItems = data;
                    });
            });
    });

    vm.wishlist = function (line) {
        alert("test");
        //PdpService
        PdpService.AddToWishList(line.Product.ID, vm.isLoggedIn);
        if (vm.isLoggedIn) {
            vm.removeItem(vm.order, line);
        }


    }

    angular.forEach(vm.lineItems.Items, function (line) {

        line.xp.deliveryDate = new Date(line.xp.deliveryDate);
    });

    var data = _.groupBy(vm.lineItems.Items, function (value) {
        if (value.ShippingAddress != null) {

            //totalCost += value.xp.TotalCost;
            return value.ShippingAddress.FirstName + ' ' + value.ShippingAddress.LastName + ' ' + (value.ShippingAddress.Street1).split(/(\d+)/g)[1] + ' ' + value.ShippingAddress.Zip + value.xp.DeliveryMethod;
        }
    });

    vm.groups = data;
    vm.linetotalvalue = 0;
    vm.lineVal = [];
    vm.lineTotal = {};
    vm.changerecipientarr = [];
    for (var n in vm.groups) {
        vm.lineVal.push(n);
        vm.lineTotal[n] = _.reduce(_.pluck(data[n], 'LineTotal'), function (memo, num) { return memo + num; }, 0);
    }

    console.log("vm.lineVal", vm.groups);

    vm.clearcart = function () {
        OrderCloud.Orders.Delete(vm.order.ID)
            .then(function () {
                CurrentOrder.Remove()
                    .then(function () {
                        $state.go('home');
                    });
            });
    };

    vm.closePopover = function () {
        vm.showDeliveryToolTip = false;
    };
    vm.deleteNote = {
        templateUrl: 'deleteNote.html',
    };
    vm.showproductrequest = {
        templateUrl: 'showproductrequest.html',
    };

    vm.productrequestpopup = function (lineItem) {
        console.log(lineItem);
        $uibModal.open({
            templateUrl: 'cart/templates/productrequest.tpl.html',
            backdropClass: 'productrequestpopup',
            windowClass: 'productrequestpopup',
            controller: 'ProductRequestCtrl',
            controllerAs: 'productRequest',
            resolve: {
                prodrequestdata: function () {
                    return lineItem;
                },
                Order: function () {
                    var order = vm.order;
                    return order;
                }
            }
        });
    }


    function changeDeliveryDate(item, index) {
        //console.log(date);
        // OrderCloud.LineItems.Patch(vm.order.ID, date.ID, date.xp).then(function (res) {
        //     console.log(res);
        // })
        var data = [];
        data[0] = item;
        vm.updateRecipientDetails(data).then(function (s) {
            if (s = 'success') {
                vm.changeLineDate[index] = false;
            }
        })

    }
    // vm.edIt = function () {
    //     alert('ss');
    //     $('.recipient-details').find('span').attr('contenteditable', 'true');

    // }

    function editrecipient(data) {
        console.log(data);
        var deferred = $q.defer();
        // var log = [];
        // for (var i = 1; i < data.length; i++) {
        //     data[i].ShippingAddress = data[0].ShippingAddress;
        // }
        var shippingAddress = data[0].ShippingAddress
        var i = 0;
        var temppromise = [];
        angular.forEach(data, function (value, key) {

            temppromise[i] = OrderCloud.LineItems.SetShippingAddress(vm.order.ID, value.ID, shippingAddress);
            i++;
        });
        $q.all(temppromise).then(function (result) {
            vm.updateRecipientDetails(result).then(function (s) {
                if (s == 'success') {
                    $state.go('cart', { ID: vm.order.ID });
                }
            });
            // var tmp = [];
            // angular.forEach(result, function (response) {
            //     tmp.push(response);
            // });
            // return tmp;
        })
        // .then(function (tmpResult) {

        //     console.log("tmpResult= ",tmpResult);
        // });



    }


    function changerecipientpopup(item) {
        $uibModal.open({
            templateUrl: 'cart/templates/changeRecipientpopup.tpl.html',
            backdropClass: 'changeRecipientpopup',
            windowClass: 'changeRecipientpopup',
            controller: 'ChangeRecipientPopupCtrl',
            controllerAs: 'changeRecipientPopup',
            resolve: {
                Lineitem: function () {
                    return item;
                },
                Order: function () {
                    return vm.order;
                },
                AddressCheck: function () {
                    return callDeliveryOptions(item);
                    function callDeliveryOptions(line) {
                        var d = $q.defer();
                        OrderCloud.Categories.ListProductAssignments(null, line.ProductID).then(function (res1) {

                            //OrderCloud.Categories.Get(res1.Items[0].CategoryID).then(function (res2) {
                            //OrderCloud.Categories.Get('c2_c1_c1').then(function (res2) {

                            OrderCloud.Categories.Get('OutdoorLivingDecor_Grilling_Grills').then(function (res2) {
                                //OrderCloud.Categories.Get('c4_c1').then(function (res2) {
                                var key = {}, MinDate = {};
                                line.xp.NoInStorePickUp = true;
                                if (res2.xp.DeliveryChargesCatWise.DeliveryMethods['InStorePickUp']) {
                                    item.xp.NoInStorePickUp = false;
                                }
                                _.each(res2.xp.DeliveryChargesCatWise.DeliveryMethods, function (v, k) {
                                    if (v.MinDays) {
                                        MinDate[k] = v.MinDays;
                                        key['MinDate'] = MinDate;
                                    }
                                    if (k == "UPS" && v['Boolean'] == true) {
                                        key[k] = {};
                                    }
                                    if (k == "USPS" && v['Boolean'] == true) {
                                        key[k] = {};
                                    }
                                    if (k == "InStorePickUp") {
                                        key[k] = {};
                                    }
                                    if (k == 'Mixed' && v['Boolean'] == true) {
                                        key[k] = {};
                                    }
                                    _.each(v, function (v1, k1) {
                                        var obj = {};
                                        if (v1['Boolean'] == true) {
                                            if (k == "Mixed" && line.Quantity < 50) {

                                            } else {
                                                obj[k1] = v1['Value'];
                                                key[k] = obj;
                                            }
                                        }
                                    });
                                });

                                if (!key['UPS'] && !key['LocalDelivery'] && !key['Mixed'] && key['InStorePickUp'] && !key['USPS'] && !key['DirectShip'] && !key['Courier']) {
                                    line.xp.NoDeliveryExInStore = true;
                                }

                                d.resolve(line);

                            });
                        });
                        return d.promise;
                    }
                }

            }
        });
    }

    function editrecipientpopup(data) {
        $uibModal.open({
            templateUrl: 'cart/templates/editrecipientpopup.tpl.html',
            backdropClass: 'changerecipientpopup',
            windowClass: 'changerecipientpopup',
            controller: 'EditRecipientPopupCtrl',
            controllerAs: 'editRecipientPopup',
            resolve: {
                Lineitems: function () {
                    return data;
                },
                Order: function () {
                    return vm.order;
                }
            }
        });
    }

    OrderCloud.SpendingAccounts.ListAssignments(null, vm.signnedinuser.ID).then(function (result) {
        angular.forEach(result.Items, function (value, key) {
            console.log(value);
            OrderCloud.SpendingAccounts.Get(value.SpendingAccountID).then(function (data) {
                if (data.Name == "Purple Perks") {
                    vm.purpleperksacc = data;
                }
            })
        })
    })


    function changeRecipientfun(lineitem, addressforlineitem) {
        if (lineitem.ShippingAddress != addressforlineitem.ShippingAddress) {
            var data = []
            lineitem.ShippingAddress = addressforlineitem.ShippingAddress;
            data[0] = lineitem;
            console.log(lineitem, addressforlineitem);
            vm.updateRecipientDetails(data).then(function (s) {
                if (s == 'success') {
                    $state.go('cart', { ID: vm.order.ID });
                    lineitem.showDeliveryToolTip = !lineitem.showDeliveryToolTip;
                }
            });
        }
        lineitem.showDeliveryToolTip = !lineitem.showDeliveryToolTip;
    }

    vm.checkDeliverymethod = checkDeliverymethod;
    function checkDeliverymethod(line) {
        var defered = $q.defer();

        vm.GetDeliveryMethods(line.ProductID).then(function (res) {

            if (res.xp.DeliveryChargesCatWise.DeliveryMethods.DirectShip) {
                line.xp.DeliveryMethod = "DirectShip";
            }
            if (res.Name == "Gift Cards") {
                line.xp.DeliveryMethod = 'USPS'
            }

            if (res.xp.DeliveryChargesCatWise.DeliveryMethods.UPS) {
                line.xp.DeliveryMethod = 'UPS';

            }
            if (res.xp.DeliveryChargesCatWise.DeliveryMethods.LocalDelivery) {
                line.xp.DeliveryMethod = 'LocalDelivery';

            }
            if (res.xp.DeliveryChargesCatWise.DeliveryMethods.UPS && res.xp.DeliveryChargesCatWise.DeliveryMethods.LocalDelivery) {
                if (line.ShippingAddress.City == "Minneapolis" || line.ShippingAddress.City == "Saint Paul") {
                    line.xp.DeliveryMethod = 'LocalDelivery';

                }
                else {

                    line.xp.DeliveryMethod = 'UPS';

                }
            }
            defered.resolve('success')

        });
        return defered.promise;

        //vm.callDeliveryOptions(line);

    }
    vm.GetDeliveryMethods = GetDeliveryMethods;
    function GetDeliveryMethods(prodID) {
        var deferred = $q.defer();
        OrderCloud.Categories.ListProductAssignments(null, prodID).then(function (res1) {

            //OrderCloud.Categories.Get(res1.Items[0].CategoryID).then(function(res2){
            //OrderCloud.Categories.Get('c2_c1_c1').then(function (res2) {
            OrderCloud.Categories.Get('OutdoorLivingDecor_Grilling_Grills').then(function (res2) {

                //OrderCloud.Categories.Get('c4_c1').then(function (res2) {

                deferred.resolve(res2);
            });
        });
        return deferred.promise;
    }
    vm.calculateDeliveryCharges = calculateDeliveryCharges;
    function calculateDeliveryCharges(line) {
        var d = $q.defer();
        PdpService.GetDeliveryOptions(line, line.xp.DeliveryMethod).then(function (res) {

            var obj = {};

            if (line.xp.DeliveryMethod == 'LocalDelivery') {

                PdpService.CompareDate(line.xp.deliveryDate).then(function (data) {
                    if (data == '1') {

                        angular.forEach(res[line.xp.DeliveryMethod], function (val, key) {
                            obj[key] = val;
                        }, true);
                        line.xp.deliveryFeesDtls = obj;
                        // if(!line.xp.DeliveryMethod)
                        // 	line.xp.DeliveryMethod = DeliveryMethod;
                        line.xp.TotalCost = 0;
                        angular.forEach(line.xp.deliveryFeesDtls, function (val, key) {

                            line.xp.TotalCost += parseFloat(val);

                        });
                        if (line.xp.TotalCost > 250) {
                            line.xp.Discount = line.xp.TotalCost - 250;
                            line.xp.TotalCost = 250;
                        }
                        line.xp.TotalCost = line.xp.TotalCost + (line.Quantity * line.UnitPrice);
                        d.resolve('1');

                    }
                    else {
                        delete res.LocalDelivery.SameDayDelivery;
                        angular.forEach(res[line.xp.DeliveryMethod], function (val, key) {
                            obj[key] = val;
                        }, true);
                        line.xp.deliveryFeesDtls = obj;
                        // if(!line.xp.DeliveryMethod)
                        // 	line.xp.DeliveryMethod = DeliveryMethod;
                        line.xp.TotalCost = 0;
                        angular.forEach(line.xp.deliveryFeesDtls, function (val, key) {

                            line.xp.TotalCost += parseFloat(val);

                        });
                        if (line.xp.TotalCost > 250) {
                            line.xp.Discount = line.xp.TotalCost - 250;
                            line.xp.TotalCost = 250;
                        }
                        line.xp.TotalCost = line.xp.TotalCost + (line.Quantity * line.UnitPrice);
                        d.resolve('1');
                    }
                    //d.resolve(1);
                })
                //d.resolve(1);
            }
            else {

                delete res.LocalDelivery.SameDayDelivery;
                angular.forEach(res[line.xp.DeliveryMethod], function (val, key) {
                    obj[key] = val;
                }, true);
                line.xp.deliveryFeesDtls = obj;
                // if(!line.xp.DeliveryMethod)
                // 	line.xp.DeliveryMethod = DeliveryMethod;
                line.xp.TotalCost = 0;
                angular.forEach(line.xp.deliveryFeesDtls, function (val, key) {

                    line.xp.TotalCost += parseFloat(val);

                });
                if (line.xp.TotalCost > 250) {
                    line.xp.Discount = line.xp.TotalCost - 250;
                    line.xp.TotalCost = 250;
                }
                line.xp.TotalCost = line.xp.TotalCost + (line.Quantity * line.UnitPrice);
                d.resolve('1');

            }




            //delete line.xp.Discount;

        });
        return d.promise;

    }

    function updateRecipientDetails(data) {
        var defered = $q.defer();
        OrderCloud.LineItems.List(vm.order.ID).then(function (res) {
            if (res.Items.length > 1) {
                var promises = [];
                var inum = 0;
                angular.forEach(data, function (val1) {
                    promises[inum] = calliteration(val1);
                    
                    inum++;
                });
                $q.all(promises).then(function (result) {
                    var tmp = [];
                    angular.forEach(result, function (response) {
                        tmp.push(response.data);
                    });
                    return tmp;
                }).then(function (tmpResult) {
                    var combinedResult = tmpResult.join(", ");
                    console.log(combinedResult);
                    defered.resolve('success');
                });

            }
            else {
                angular.forEach(data, function (val1, key1, obj1) {
                    vm.getCityState(val1, val1.ShippingAddress.Zip).then(function (z) {
                        if (z == 'zip') {
                            vm.checkDeliverymethod(val1).then(function (r) {
                                if (r == 'success') {
                                    vm.calculateDeliveryCharges(val1).then(function (r1) {
                                        if (r1 == '1') {
                                            vm.updateLinedetails(vm.order.ID, val1).then(function (u) {
                                                if (u == 'updated') {
                                                    defered.resolve('success');
                                                }
                                            })

                                        }
                                    })
                                }
                            });
                        }
                    });

                });

            }

        });
        function calliteration(val1) {
            var d = $q.defer();
            var newLineItems = []
            OrderCloud.LineItems.List(vm.order.ID).then(function (res) {
                newLineItems = res.Items;
                newLineItems.splice(_.indexOf(newLineItems, _.find(newLineItems, function (val) { return val.ID == val1.ID; })), 1);
                vm.checkDeliverymethod(val1).then(function (r) {
                    if (r == 'success') {
                        vm.checkLineItemsId(newLineItems, val1, d).then(function (id) {
                            if (id == 'notsameId') {
                                vm.checkLineItemsAddress(newLineItems, val1, d).then(function (address) {
                                    if (address == 'notsameAddress') {
                                        vm.calculateDeliveryCharges(val1).then(function (r1) {
                                            if (r1 == '1') {
                                                vm.updateLinedetails(vm.order.ID, val1).then(function (u) {
                                                    d.resolve("success");
                                                })


                                            }
                                        })
                                    }
                                })
                            }
                        })


                    }
                });
            });

            return d.promise;
        }
        return defered.promise;
    }
    vm.updateLinedetails = updateLinedetails;
    function updateLinedetails(args, newline) {
        delete newline.xp.NoInStorePickUp;
        delete newline.xp.NoDeliveryExInStore;
        var defered = $q.defer()
        OrderCloud.LineItems.Update(args, newline.ID, newline).then(function (dat) {
            console.log("LineItemsUpdate", JSON.stringify(newline.ShippingAddress));
            OrderCloud.LineItems.SetShippingAddress(args, newline.ID, newline.ShippingAddress).then(function (data) {
                console.log("SetShippingAddress", data);
                alert("Data submitted successfully");
                //vm.getLineItems();
                defered.resolve('updated')
            });

        });
        return defered.promise;
    }

    function getCityState(line, zip) {
        var defered = $q.defer();
        PdpService.getCityState(zip).then(function (res) {
            line.ShippingAddress.City = res.City;
            line.ShippingAddress.State = res.State;
            line.ShippingAddress.Country = res.Country;
            defered.resolve('zip')
        });
        return defered.promise;
    }

    function checkLineItemsAddress(res, line, d) {
        var count = 0;
        var deferred = $q.defer();
        angular.forEach(res, function (val, key, obj) {

            var a = new Date(val.xp.deliveryDate);
            var b = new Date(line.xp.deliveryDate);

            var DateA = Date.UTC(a.getFullYear(), a.getMonth() + 1, a.getDate());
            var DateB = Date.UTC(b.getFullYear(), b.getMonth() + 1, b.getDate());

            if (val.ShippingAddress.FirstName == line.ShippingAddress.FirstName && val.ShippingAddress.LastName == line.ShippingAddress.LastName && (val.ShippingAddress.Street1).split(/(\d+)/g)[1] == (line.ShippingAddress.Street1).split(/(\d+)/g)[1] && DateA == DateB) {
                if (count == 0) {
                    line.xp.TotalCost = parseFloat(line.UnitPrice) * parseFloat(line.Quantity);
                    count++
                    vm.updateLinedetails(vm.order.ID, line).then(function (u) {
                        if (u == 'updted') {
                            deferred.resolve('sameAddress');
                            d.resolve("success");
                        }
                    })

                }
            }
        });
        if (count == 0) {
            deferred.resolve('notsameAddress');
        }

        return deferred.promise;
    }
    vm.checkLineItemsId = checkLineItemsId;
    function checkLineItemsId(res, line, d) {
        var deferred = $q.defer();
        var count = 0;

        angular.forEach(res, function (val, key, obj) {
            var a = new Date(val.xp.deliveryDate);
            var b = new Date(line.xp.deliveryDate);

            var DateA = Date.UTC(a.getFullYear(), a.getMonth() + 1, a.getDate());
            var DateB = Date.UTC(b.getFullYear(), b.getMonth() + 1, b.getDate());

            if (val.ProductID == line.ProductID && val.ShippingAddress.FirstName == line.ShippingAddress.FirstName && val.ShippingAddress.LastName == line.ShippingAddress.LastName && (val.ShippingAddress.Street1).split(/(\d+)/g)[1] == (line.ShippingAddress.Street1).split(/(\d+)/g)[1] && val.xp.DeliveryMethod == line.xp.DeliveryMethod && DateA == DateB) {
                if (count == 0) {
                    val.Quantity += line.Quantity;
                    vm.calculateDeliveryCharges(val).then(function (data) {
                        if (data == '1') {
                            vm.updateLinedetails(vm.order.ID, val).then(function (u) {
                                if (u == 'updated') {
                                    d.resolve("success");
                                }
                            })
                        }
                    });
                    count++
                    OrderCloud.LineItems.Delete(vm.order.ID, line.ID).then(function (data) {
                        console.log("Lineitemdeleted", data);
                    });
                    deferred.resolve('sameId');
                }
            }

        });
        if (count == 0) {
            deferred.resolve('notsameId');
        }
        return deferred.promise;
    }

    console.log(angular.element(document.getElementById("changerecipientid")).scope());
    $rootScope.$on('newRecipientCreated', function (events, Lineitem) {
        var data = []
        data[0] = Lineitem;
        console.log('Lineitem', Lineitem);
        vm.updateRecipientDetails(data).then(function (s) {
            if (s == 'success') {
                $state.go('cart', { ID: vm.order.ID });
            }
        });
    });
    $rootScope.$on('recipientEdited', function (events, Lineitems) {

        vm.editrecipient(Lineitems);
    });
    function changeQuantity(lineItem) {

        OrderCloud.LineItems.Get(vm.order.ID, lineItem.ID).then(function (data) {
            console.log("LineitemQuantity", data);
            var lineitemFee = parseFloat(data.xp.TotalCost) - parseFloat(data.Quantity * data.UnitPrice);
            lineItem.xp.TotalCost = lineitemFee + (lineItem.Quantity * lineItem.UnitPrice);
            OrderCloud.LineItems.Update(vm.order.ID, lineItem.ID, lineItem).then(function (dat) {
                console.log("LineItemsUpdate", JSON.stringify(dat));
                OrderCloud.LineItems.SetShippingAddress(vm.order.ID, lineItem.ID, lineItem.ShippingAddress).then(function (data) {
                    console.log("SetShippingAddress", data);
                    alert("Data submitted successfully");
                    //vm.getLineItems();

                });

            });
        });
    }
    vm.changeLineDate = []
    function changeDate(index) {
        vm.changeLineDate[index] = (!!vm.changeLineDate[index]) ? false : true;
        console.log(index);
    }
    function removeItem(order, lineItem) {
        var result = confirm('Please Conform removing Item');
        if (result) {
            var defered = $q.defer();
            var newLineItems = [];
            var data = [];
            data[0] = lineItem;

            OrderCloud.LineItems.List(vm.order.ID).then(function (res) {
                if (res.Items.length > 1) {
                    if (lineItem.TotalCost == (lineItem.UnitPrice * lineItem.Quantity)) {
                        // deleteLineItem
                        vm.RemoveLineItem(order, lineItem);
                    }
                    else {
                        newLineItems = res.Items;
                        var count = 0;
                        angular.forEach(data, function (val1, key1, obj1) {
                            newLineItems.splice(_.indexOf(newLineItems, _.find(newLineItems, function (val) { return val.ID == val1.ID; })), 1);

                            count++;

                        });
                        console.log('newLineItems', newLineItems);


                        if (count > 0) {
                            vm.checkLineItemFeeDetails(newLineItems, lineItem).then(function (FeeDetails) {

                                if (FeeDetails == 'LineItemFeeDetailsupdated' || FeeDetails == 'LineItemFeeDetailsNotupdated') {

                                    vm.RemoveLineItem(order, lineItem);

                                }

                            })
                        }
                    }
                }

                else {

                    vm.RemoveLineItem(order, lineItem);
                }

            });
        }

    }
    vm.checkLineItemFeeDetails = checkLineItemFeeDetails;
    function checkLineItemFeeDetails(res, line) {
        var count = 0;
        var deferred = $q.defer();
        angular.forEach(res, function (val, key, obj) {

            var a = new Date(val.xp.deliveryDate);
            var b = new Date(line.xp.deliveryDate);

            var DateA = Date.UTC(a.getFullYear(), a.getMonth() + 1, a.getDate());
            var DateB = Date.UTC(b.getFullYear(), b.getMonth() + 1, b.getDate());

            if (val.ShippingAddress.FirstName == line.ShippingAddress.FirstName && val.ShippingAddress.LastName == line.ShippingAddress.LastName && (val.ShippingAddress.Street1).split(/(\d+)/g)[1] == (line.ShippingAddress.Street1).split(/(\d+)/g)[1] && DateA == DateB) {
                if (count == 0) {
                    line.xp.TotalCost = parseFloat(line.UnitPrice) * parseFloat(line.Quantity);
                    count++
                    vm.calculateDeliveryCharges(val).then(function (r1) {
                        if (r1 == '1') {
                            vm.updateLinedetails(vm.order.ID, val).then(function (u) {
                                if (u == 'updated') {

                                    deferred.resolve('LineItemFeeDetailsupdated');
                                }
                            })


                        }
                    })


                }
            }
        });
        if (count == 0) {
            deferred.resolve('LineItemFeeDetailsNotupdated');
        }

        return deferred.promise;
    }
    vm.RemoveLineItem = RemoveLineItem;
    function RemoveLineItem(Order, LineItem) {
        OrderCloud.LineItems.Delete(Order.ID, LineItem.ID)
            .then(function () {
                // If all line items are removed delete the order.
                OrderCloud.LineItems.List(Order.ID)
                    .then(function (data) {
                        if (!data.Items.length) {
                            CurrentOrder.Remove();
                            OrderCloud.Orders.Delete(Order.ID).then(function () {
                                $state.go('cart');
                                $rootScope.$broadcast('OC:RemoveOrder');
                            });
                        } else {
                            $state.go('cart', { ID: vm.order.ID });
                        }
                    });
            });
    }

    /*carousel*/

    setTimeout(function () {
        var owl2 = angular.element("#owl-carousel-cart");
        owl2.owlCarousel({
            //responsive: true,
            loop: true,
            nav: true,
            responsive: {
                0: { items: 1 },
                320: {
                    items: 2,
                },
                730: {
                    items: 3,
                },
                1024: {
                    items: 4
                }
            }
        });
    }, 1000)
}

function MiniCartController($q, $state, $rootScope, OrderCloud, LineItemHelpers, CurrentOrder, $uibModal) {
    var vm = this;
    vm.LineItems = {};
    vm.Order = null;
    vm.showLineItems = false;


    vm.getLI = function () {
        CurrentOrder.Get()
            .then(function (data) {
                vm.Order = data;
                if (data) vm.lineItemCall(data);
            });
    };

    vm.getLI();

    vm.checkForExpress = function () {
        var expressCheckout = false;
        angular.forEach($state.get(), function (state) {
            if (state.url && state.url == '/expressCheckout') {
                expressCheckout = true;
                return expressCheckout;
            }
        });
        return expressCheckout;
    };

    vm.checkForCheckout = function () {
        var checkout = false;
        angular.forEach($state.get(), function (state) {
            if (state.url && state.url == '/checkout') {
                checkout = true;
                return checkout;
            }
        });
        return checkout;
    };

    vm.goToCart = function () {
        $state.go('cart', {}, { reload: true });
    };

    vm.lineItemCall = function /*getLineItems*/(order) {
        var dfd = $q.defer();
        var queue = [];
        OrderCloud.LineItems.List(order.ID)
            .then(function (li) {
                vm.LineItems = li;
                if (li.Meta.TotalPages > li.Meta.Page) {
                    var page = li.Meta.Page;
                    while (page < li.Meta.TotalPages) {
                        page += 1;
                        queue.push(OrderCloud.LineItems.List(order.ID, page));
                    }
                }
                $q.all(queue)
                    .then(function (results) {
                        angular.forEach(results, function (result) {
                            vm.LineItems.Items = [].concat(vm.LineItems.Items, result.Items);
                            vm.LineItems.Meta = result.Meta;
                        });
                        dfd.resolve(LineItemHelpers.GetProductInfo(vm.LineItems.Items.reverse()));
                    });
            });
        return dfd.promise;
    };

    $rootScope.$on('LineItemAddedToCart', function () {
        CurrentOrder.Get()
            .then(function (order) {
                vm.lineItemCall(order);
                vm.showLineItems = true;
            });
    });


    $rootScope.$on('OC:RemoveOrder', function () { //broadcast is in build > src > app > common > line items
        vm.Order = null;
        vm.LineItems = {};
    });
    vm.editcartdetails = function (lineItem) {
        console.log(lineItem);
        var modalInstance = $uibModal.open({
            animation: true,
            backdropClass: 'miniCartEditModal',
            windowClass: 'miniCartEditModal',
            templateUrl: 'cart/templates/editcartpopup.tpl.html',
            controller: 'editCartPopupCtrl',
            controllerAs: 'editCartPopup',
            resolve: {

            }
        });

        modalInstance.result.then(function (selectedItem) {
            $scope.selected = selectedItem;
        }, function () {
            angular.noop();
        });
    }
}

function OrderCloudMiniCartDirective() {
    return {
        restrict: 'E',
        scope: {},
        templateUrl: 'cart/templates/minicart.tpl.html',
        controller: 'MiniCartCtrl',
        controllerAs: 'minicart'
    };
}

function ProductRequestController($uibModal, $scope, $stateParams, prodrequestdata, $uibModalInstance, OrderCloud, Order) {
    var vm = this;
    vm.order = Order;
    vm.prodrequestdata = prodrequestdata;
    vm.cancel = function () {
        $uibModalInstance.close();
    }

    vm.save = function (data) {
        console.log(data);
        var updateline = { "xp": data };
        OrderCloud.LineItems.Patch(vm.order.ID, vm.prodrequestdata.ID, updateline).then(function (test) {
            $uibModalInstance.close();
        })
    }
}
function ChangeRecipientPopupController($uibModal, $scope, $uibModalInstance, Lineitem, $rootScope, PdpService, $cookieStore, $q, OrderCloud, AddressValidationService) {
    var vm = this;
    vm.cancel = cancel;
    vm.getCityState = getCityState;
    vm.changedtls = changedtls;
    vm.addressType = " ";
    vm.showaddress = false;
    vm.savedBookAddress = {};
    vm.addBookAddress = addBookAddress;
    vm.limit = 4;
    vm.saveUserAddressData = saveUserAddressData;
    vm.saveaddressdata = false;
    // vm.init = init;
    vm.name = '';
    vm.addressTypeChanged = addressTypeChanged;

    vm.isLoggedIn = $cookieStore.get('isLoggedIn');
    var item = {
        "Quantity": Lineitem.Quantity,

        "ShippingAddress": {},

        "xp": {}
    };
    item.xp.deliveryDate = Lineitem.xp.deliveryDate;
    //init(item);
    if (!Lineitem.xp.NoDeliveryExInStore) {
        vm.addressType = 'Residence';
    }
    else if (!Lineitem.xp.NoInStorePickUp && item.xp.NoDeliveryExInStore) {
        vm.addressType = 'Will Call'
    }
    vm.item = item;
    function cancel() {
        $uibModalInstance.dismiss('cancel');
    };


    function changedtls(data) {
        AddressValidationService.Validate(data.ShippingAddress)
            .then(function (response) {
                if (response.ResponseBody.ResultCode == 'Success') {
                    var validatedAddress = response.ResponseBody.Address;
                    var zip = validatedAddress.PostalCode.substring(0, 5);
                    data.ShippingAddress.Zip = parseInt(zip);
                    if (validatedAddress.Line2) {
                        data.ShippingAddress.Street1 = validatedAddress.Line2;
                        data.ShippingAddress.Street2 = validatedAddress.Line1;
                    }
                    else {
                        data.ShippingAddress.Street1 = validatedAddress.Line1;
                        data.ShippingAddress.Street2 = null;
                    }
                    data.ShippingAddress.City = validatedAddress.City;
                    data.ShippingAddress.State = validatedAddress.Region;
                    data.ShippingAddress.Country = validatedAddress.Country;
                    if (data.ShippingAddress.Phone1 && data.ShippingAddress.Phone2 && data.ShippingAddress.Phone3) {
                        data.ShippingAddress.Phone = '(' + data.ShippingAddress.Phone1 + ')' + ' ' + data.ShippingAddress.Phone2 + '-' + data.ShippingAddress.Phone3;
                        delete data.ShippingAddress.Phone1;
                        delete data.ShippingAddress.Phone2;
                        delete data.ShippingAddress.Phone3;

                    }
                    console.log(data);
                    Lineitem.ShippingAddress = data.ShippingAddress;
                    $rootScope.$broadcast('newRecipientCreated', Lineitem);
                    $uibModalInstance.dismiss('cancel');
                } else {
                    alert("Address not found...");
                }
            });
        // if (data.ShippingAddress.Phone1 && data.ShippingAddress.Phone2 && data.ShippingAddress.Phone3) {
        //     data.ShippingAddress.Phone = '(' + data.ShippingAddress.Phone1 + ')' + ' ' + data.ShippingAddress.Phone2 + '-' + data.ShippingAddress.Phone3;
        //     delete data.ShippingAddress.Phone1;
        //     delete data.ShippingAddress.Phone2;
        //     delete data.ShippingAddress.Phone3;

        // }
        // console.log(data);
        // Lineitem.ShippingAddress = data.ShippingAddress;
        // $rootScope.$broadcast('newRecipientCreated', Lineitem);
        // $uibModalInstance.dismiss('cancel');
    }
    function getCityState(item) {
        PdpService.getCityState(item.ShippingAddress.Zip).then(function (res) {
            item.ShippingAddress.City = res.City;
            item.ShippingAddress.State = res.State;
            item.ShippingAddress.Country = res.Country;
        });
    }
    function addressBook() {
        if (vm.addressType == "Residence") {
            vm.showaddress = !!!vm.showaddress;
            if (vm.showaddress) {

                OrderCloud.Me.ListAddresses(null, null, 100).then(function (res) {
                    console.log(res);
                    vm.addressbook = res;
                })
            }
        }
        else {
            vm.showaddress = false;
        }


    }
    function addBookAddress(lineitem, address) {
        if (vm.addressType == "Residence") {
            if (address)
                lineitem.ShippingAddress = address;
            if (lineitem.ShippingAddress.Phone) {
                PdpService.GetPhoneNumber(lineitem.ShippingAddress.Phone).then(function (res) {
                    lineitem.ShippingAddress.Phone1 = res[0];
                    lineitem.ShippingAddress.Phone2 = res[1];
                    lineitem.ShippingAddress.Phone3 = res[2];
                });
            }

        }
    }
    function saveUserAddressData(check, line) {
        if (check == true) {
            var phone = "(" + line.ShippingAddress.Phone1 + ")" + " " + line.ShippingAddress.Phone2 + " - " + line.ShippingAddress.Phone3;
            var addressdata = { "Shipping": true, "FirstName": line.ShippingAddress.FirstName, "LastName": line.ShippingAddress.LastName, "Street1": line.ShippingAddress.Street1, "Street2": line.ShippingAddress.Street2, "City": line.ShippingAddress.City, "State": line.ShippingAddress.State, "Zip": line.ShippingAddress.Zip, "Country": line.ShippingAddress.Country, "Phone": phone, "xp": { "NickName": "", "IsDefault": false } };
            OrderCloud.Me.CreateAddress(addressdata).then(function (res) {
                console.log(res);
            })
        }
    }
    // function init(item) {
    //     callDeliveryOptions(Lineitem, item).then(function (result) {
    //         console.log("item = " + result)
    //         if (!item.xp.NoDeliveryExInStore) {
    //             vm.addressType = 'Residence';
    //         }
    //         else if (!items.xp.NoInStorePickUp && item.xp.NoDeliveryExInStore) {
    //             vm.addressType = 'Will Call'
    //         }
    //     })
    // }
    // function callDeliveryOptions(line, item) {
    //     var d = $q.defer();
    //     OrderCloud.Categories.ListProductAssignments(null, line.ProductID).then(function (res1) {

    //         //OrderCloud.Categories.Get(res1.Items[0].CategoryID).then(function (res2) {
    //         //OrderCloud.Categories.Get('c2_c1_c1').then(function (res2) {

    //         OrderCloud.Categories.Get('OutdoorLivingDecor_Grilling_Grills').then(function (res2) {
    //             //OrderCloud.Categories.Get('c4_c1').then(function (res2) {
    //             var key = {}, MinDate = {};
    //             item.xp.NoInStorePickUp = true;
    //             if (res2.xp.DeliveryChargesCatWise.DeliveryMethods['InStorePickUp']) {
    //                 item.xp.NoInStorePickUp = false;
    //             }
    //             _.each(res2.xp.DeliveryChargesCatWise.DeliveryMethods, function (v, k) {
    //                 if (v.MinDays) {
    //                     MinDate[k] = v.MinDays;
    //                     key['MinDate'] = MinDate;
    //                 }
    //                 if (k == "UPS" && v['Boolean'] == true) {
    //                     key[k] = {};
    //                 }
    //                 if (k == "USPS" && v['Boolean'] == true) {
    //                     key[k] = {};
    //                 }
    //                 if (k == "InStorePickUp") {
    //                     key[k] = {};
    //                 }
    //                 if (k == 'Mixed' && v['Boolean'] == true) {
    //                     key[k] = {};
    //                 }
    //                 _.each(v, function (v1, k1) {
    //                     var obj = {};
    //                     if (v1['Boolean'] == true) {
    //                         if (k == "Mixed" && line.Quantity < 50) {

    //                         } else {
    //                             obj[k1] = v1['Value'];
    //                             key[k] = obj;
    //                         }
    //                     }
    //                 });
    //             });

    //             if (!key['UPS'] && !key['LocalDelivery'] && !key['Mixed'] && key['InStorePickUp'] && !key['USPS'] && !key['DirectShip'] && !key['Courier']) {
    //                 item.xp.NoDeliveryExInStore = true;
    //             }

    //             d.resolve(item);

    //         });
    //     });
    //     return d.promise;
    // }
    vm.IsNumeric = function ($e) {
        console.log($e);
        var keyCode = $e.which ? $e.which : $e.keyCode;
        var ret = ((keyCode >= 48 && keyCode <= 57) || specialKeys.indexOf(keyCode) != -1);
        if (!ret)
            $e.preventDefault();
    }
    function addressTypeChanged(lineitem, addressType) {
        angular.forEach(lineitem.ShippingAddress, function (value, key) {
            console.log(key + ': ' + value);
            if (key == 'Street1' || key == 'Street2' || key == 'City' || key == 'State' || key == 'Zip' || key == 'Country' || key == 'Phone1' || key == 'Phone2' || key == 'Phone3') {
                lineitem.ShippingAddress[key] = null;
            }

        });

        lineitem.xp.addressType = addressType;

    }
    var storesData;
    PdpService.GetStores().then(function (res) {
        storesData = res.data.stores;
        vm.storeNames = _.pluck(res.data.stores, 'storeName');
    });
    function storesDetails(item, line, name) {
        var store = line;
        var filt = _.filter(storesData, function (row) {
            return _.indexOf([item], row.storeName) > -1;
        });
        if (store.ShippingAddress == null)
            store.ShippingAddress = {};

        store.ShippingAddress.Street1 = filt[0].storeAddress;
        store.ShippingAddress.City = filt[0].city;
        store.ShippingAddress.State = filt[0].state;
        store.ShippingAddress.Zip = parseInt(filt[0].zipCode);
        store.ShippingAddress.CompanyName = name
        store.xp.DeliveryMethod = "InStorePickUp";

        PdpService.GetPhoneNumber(filt[0].phoneNumber).then(function (res) {
            store.ShippingAddress.Phone1 = res[0];
            store.ShippingAddress.Phone2 = res[1];
            store.ShippingAddress.Phone3 = res[2];
        });

        //vm.checkDeliverymethod(line, index)
    };
    var hospitalData;
    PdpService.GetHospitals().then(function (res) {
        hospitalData = res;
        vm.hospitalNames = _.pluck(hospitalData, 'AddressName');
    });
    function hospitalDetails(item, line, name) {
        var hospital = line;
        var filt = _.filter(hospitalData, function (row) {
            return _.indexOf([item], row.AddressName) > -1;
        });
        if (hospital.ShippingAddress == null)
            hospital.ShippingAddress = {};
        hospital.ShippingAddress.Street1 = filt[0].Street1;
        hospital.ShippingAddress.Street2 = filt[0].Street2;
        hospital.ShippingAddress.City = filt[0].City;
        hospital.ShippingAddress.State = filt[0].State;
        hospital.ShippingAddress.Zip = parseInt(filt[0].Zip);
        hospital.ShippingAddress.CompanyName = name
        if (filt[0].Phone) {
            hospital.ShippingAddress.Phone1 = filt[0].Phone.substr(0, 3);
            hospital.ShippingAddress.Phone2 = filt[0].Phone.substr(3, 3);
            hospital.ShippingAddress.Phone3 = filt[0].Phone.substr(6);
        }
        // PdpService.GetOldPhoneNumber(filt[0].phoneNumber).then(function (res) {
        // 	store.ShippingAddress.Phone1 = res[0];
        // 	store.ShippingAddress.Phone2 = res[1];
        // 	store.ShippingAddress.Phone3 = res[2];
        // });
        // vm.checkDeliverymethod(line, index)
    };
    var funeralHomeData;
    PdpService.GetFuneralHomes().then(function (res) {
        funeralHomeData = res;
        vm.funeralHomes = _.pluck(funeralHomeData, 'AddressName');
    });
    vm.funeralHomeDetails = funeralHomeDetails;
    function funeralHomeDetails(item, line, name) {
        var funeralHome = line;
        var filt = _.filter(funeralHomeData, function (row) {
            return _.indexOf([item], row.AddressName) > -1;
        });
        if (funeralHome.ShippingAddress == null)
            funeralHome.ShippingAddress = {};
        //store.ShippingAddress.FirstName = filt[0].storeName;
        //store.ShippingAddress.LastName = filt[0].storeName;
        funeralHome.ShippingAddress.Street1 = filt[0].Street1;
        funeralHome.ShippingAddress.Street2 = filt[0].Street2;
        funeralHome.ShippingAddress.City = filt[0].City;
        funeralHome.ShippingAddress.State = filt[0].State;
        funeralHome.ShippingAddress.Zip = parseInt(filt[0].Zip);
        funeralHome.ShippingAddress.CompanyName = name
        if (filt[0].Phone) {
            funeralHome.ShippingAddress.Phone1 = filt[0].Phone.substr(0, 3);
            funeralHome.ShippingAddress.Phone2 = filt[0].Phone.substr(3, 3);
            funeralHome.ShippingAddress.Phone3 = filt[0].Phone.substr(6);
        }
        // PdpService.GetPhoneNumber(filt[0].phoneNumber).then(function (res) {
        // 	store.ShippingAddress.Phone1 = res[0];
        // 	store.ShippingAddress.Phone2 = res[1];
        // 	store.ShippingAddress.Phone3 = res[2];
        // });

        vm.checkDeliverymethod(line, index)
    };
    var churchData;
    PdpService.GetChurches().then(function (res) {
        churchData = res;
        vm.churchNames = _.pluck(churchData, 'AddressName');
    });
    vm.churchDetails = churchDetails;
    function churchDetails(item, line, name) {
        var church = line;
        var filt = _.filter(churchData, function (row) {
            return _.indexOf([item], row.AddressName) > -1;
        });
        if (church.ShippingAddress == null)
            church.ShippingAddress = {};
        //store.ShippingAddress.FirstName = filt[0].storeName;
        //store.ShippingAddress.LastName = filt[0].storeName;
        church.ShippingAddress.Street1 = filt[0].Street1;
        church.ShippingAddress.Street2 = filt[0].Street2;
        church.ShippingAddress.City = filt[0].City;
        church.ShippingAddress.State = filt[0].State;
        church.ShippingAddress.Zip = parseInt(filt[0].Zip);
        church.ShippingAddress.CompanyName = name
        if (filt[0].Phone) {
            church.ShippingAddress.Phone1 = filt[0].Phone.substr(0, 3);
            church.ShippingAddress.Phone2 = filt[0].Phone.substr(3, 3);
            church.ShippingAddress.Phone3 = filt[0].Phone.substr(6);
        }
        // PdpService.GetPhoneNumber(filt[0].phoneNumber).then(function (res) {
        // 	store.ShippingAddress.Phone1 = res[0];
        // 	store.ShippingAddress.Phone2 = res[1];
        // 	store.ShippingAddress.Phone3 = res[2];
        // });

        // vm.checkDeliverymethod(line, index)
    };
    var CemeteryData;
    PdpService.Getcemeteries
    PdpService.Getcemeteries().then(function (res) {
        CemeteryData = res;
        vm.cemeteries = _.pluck(CemeteryData, 'AddressName');
    });
    vm.cemeteryDetails = cemeteryDetails;
    function cemeteryDetails(item, line, name) {
        var cemetery = line;
        var filt = _.filter(CemeteryData, function (row) {
            return _.indexOf([item], row.AddressName) > -1;
        });
        if (cemetery.ShippingAddress == null)
            cemetery.ShippingAddress = {};
        //store.ShippingAddress.FirstName = filt[0].storeName;
        //store.ShippingAddress.LastName = filt[0].storeName;
        cemetery.ShippingAddress.Street1 = filt[0].Street1;
        cemetery.ShippingAddress.Street2 = filt[0].Street2;
        cemetery.ShippingAddress.City = filt[0].City;
        cemetery.ShippingAddress.State = filt[0].State;
        cemetery.ShippingAddress.Zip = parseInt(filt[0].Zip);
        cemetery.ShippingAddress.CompanyName = name
        if (filt[0].Phone) {
            cemetery.ShippingAddress.Phone1 = filt[0].Phone.substr(0, 3);
            cemetery.ShippingAddress.Phone2 = filt[0].Phone.substr(3, 3);
            cemetery.ShippingAddress.Phone3 = filt[0].Phone.substr(6);
        }
        // PdpService.GetPhoneNumber(filt[0].phoneNumber).then(function (res) {
        // 	store.ShippingAddress.Phone1 = res[0];
        // 	store.ShippingAddress.Phone2 = res[1];
        // 	store.ShippingAddress.Phone3 = res[2];
        // });

        // vm.checkDeliverymethod(line, index)
    };

}
function EditRecipientPopupController($uibModal, $scope, $uibModalInstance, Order, OrderCloud, AddressValidationService, Lineitems, $rootScope, PdpService, $cookieStore, $q) {
    var vm = this;
    vm.order = Order;
    vm.cancel = cancel;
    vm.getCityState = getCityState;
    vm.changedtls = changedtls;
    vm.addressType = " ";
    vm.showaddress = false;
    vm.savedBookAddress = {};
    vm.addBookAddress = addBookAddress;
    vm.limit = 4;
    vm.saveUserAddressData = saveUserAddressData;
    vm.saveaddressdata = false;
    vm.init = init;
    vm.name = '';
    vm.addressTypeChanged = addressTypeChanged;

    vm.isLoggedIn = $cookieStore.get('isLoggedIn');
    var item = {
        "Quantity": Lineitems[0].Quantity,

        "ShippingAddress": {},

        "xp": {}
    };
    if (Lineitems[0].ShippingAddress.Phone) {
        PdpService.GetPhoneNumber(Lineitems[0].ShippingAddress.Phone).then(function (res) {
            Lineitems[0].ShippingAddress.Phone1 = res[0];
            Lineitems[0].ShippingAddress.Phone2 = res[1];
            Lineitems[0].ShippingAddress.Phone3 = res[2];
        });
    }
    item.ShippingAddress = Lineitems[0].ShippingAddress;
    item.xp.deliveryDate = Lineitems[0].xp.deliveryDate;
    item.xp.addressType = Lineitems[0].xp.addressType;
    init(item);
    vm.item = item;
    function cancel() {
        $uibModalInstance.dismiss('cancel');
    };

    function addressBook() {
        if (vm.addressType == "Residence") {
            vm.showaddress = !!!vm.showaddress;
            if (vm.showaddress) {

                OrderCloud.Me.ListAddresses(null, null, 100).then(function (res) {
                    console.log(res);
                    vm.addressbook = res;
                })
            }
        }
        else {
            vm.showaddress = false;
        }


    }
    function addBookAddress(lineitem, address) {
        if (vm.addressType == "Residence") {
            if (address)
                lineitem.ShippingAddress = address;
            if (lineitem.ShippingAddress.Phone) {
                PdpService.GetPhoneNumber(lineitem.ShippingAddress.Phone).then(function (res) {
                    lineitem.ShippingAddress.Phone1 = res[0];
                    lineitem.ShippingAddress.Phone2 = res[1];
                    lineitem.ShippingAddress.Phone3 = res[2];
                });
            }

        }
    }
    function saveUserAddressData(check, line) {
        if (check == true) {
            var phone = "(" + line.ShippingAddress.Phone1 + ")" + " " + line.ShippingAddress.Phone2 + " - " + line.ShippingAddress.Phone3;
            var addressdata = { "Shipping": true, "FirstName": line.ShippingAddress.FirstName, "LastName": line.ShippingAddress.LastName, "Street1": line.ShippingAddress.Street1, "Street2": line.ShippingAddress.Street2, "City": line.ShippingAddress.City, "State": line.ShippingAddress.State, "Zip": line.ShippingAddress.Zip, "Country": line.ShippingAddress.Country, "Phone": phone, "xp": { "NickName": "", "IsDefault": false } };
            OrderCloud.Me.CreateAddress(addressdata).then(function (res) {
                console.log(res);
            })
        }
    }
    function changedtls(line) {
        AddressValidationService.Validate(line.ShippingAddress)
            .then(function (response) {
                if (response.ResponseBody.ResultCode == 'Success') {
                    var validatedAddress = response.ResponseBody.Address;
                    var zip = validatedAddress.PostalCode.substring(0, 5);
                    line.ShippingAddress.Zip = parseInt(zip);
                    if (validatedAddress.Line2) {
                        line.ShippingAddress.Street1 = validatedAddress.Line2;
                        line.ShippingAddress.Street2 = validatedAddress.Line1;
                    }
                    else {
                        line.ShippingAddress.Street1 = validatedAddress.Line1;
                        line.ShippingAddress.Street2 = null;
                    }
                    line.ShippingAddress.City = validatedAddress.City;
                    line.ShippingAddress.State = validatedAddress.Region;
                    line.ShippingAddress.Country = validatedAddress.Country;
                    if (line.ShippingAddress.Phone1 && line.ShippingAddress.Phone2 && line.ShippingAddress.Phone3) {
                        line.ShippingAddress.Phone = '(' + line.ShippingAddress.Phone1 + ')' + ' ' + line.ShippingAddress.Phone2 + '-' + line.ShippingAddress.Phone3;
                        delete line.ShippingAddress.Phone1;
                        delete line.ShippingAddress.Phone2;
                        delete line.ShippingAddress.Phone3;

                    }
                    delete line.xp.NoInStorePickUp;
                    delete line.xp.NoDeliveryExInStore
                    console.log(line);
                    $rootScope.$broadcast('recipientEdited', Lineitems);
                    $uibModalInstance.dismiss('cancel');
                } else {
                    alert("Address not found...");
                }
            });
    }
    function getCityState(item) {
        PdpService.getCityState(item.ShippingAddress.Zip).then(function (res) {
            item.ShippingAddress.City = res.City;
            item.ShippingAddress.State = res.State;
            item.ShippingAddress.Country = res.Country;
        });
    }
    function init(item) {
        callDeliveryOptions(Lineitems[0], item).then(function (result) {
            console.log("item = " + result)
        })
    }
    function callDeliveryOptions(line, item) {
        var d = $q.defer();
        OrderCloud.Categories.ListProductAssignments(null, line.ProductID).then(function (res1) {

            //OrderCloud.Categories.Get(res1.Items[0].CategoryID).then(function (res2) {
            //OrderCloud.Categories.Get('c2_c1_c1').then(function (res2) {

            OrderCloud.Categories.Get('OutdoorLivingDecor_Grilling_Grills').then(function (res2) {
                //OrderCloud.Categories.Get('c4_c1').then(function (res2) {
                var key = {}, MinDate = {};
                item.xp.NoInStorePickUp = true;
                if (res2.xp.DeliveryChargesCatWise.DeliveryMethods['InStorePickUp']) {
                    item.xp.NoInStorePickUp = false;
                }
                _.each(res2.xp.DeliveryChargesCatWise.DeliveryMethods, function (v, k) {
                    if (v.MinDays) {
                        MinDate[k] = v.MinDays;
                        key['MinDate'] = MinDate;
                    }
                    if (k == "UPS" && v['Boolean'] == true) {
                        key[k] = {};
                    }
                    if (k == "USPS" && v['Boolean'] == true) {
                        key[k] = {};
                    }
                    if (k == "InStorePickUp") {
                        key[k] = {};
                    }
                    if (k == 'Mixed' && v['Boolean'] == true) {
                        key[k] = {};
                    }
                    _.each(v, function (v1, k1) {
                        var obj = {};
                        if (v1['Boolean'] == true) {
                            if (k == "Mixed" && line.Quantity < 50) {

                            } else {
                                obj[k1] = v1['Value'];
                                key[k] = obj;
                            }
                        }
                    });
                });

                if (!key['UPS'] && !key['LocalDelivery'] && !key['Mixed'] && key['InStorePickUp'] && !key['USPS'] && !key['DirectShip'] && !key['Courier']) {
                    item.xp.NoDeliveryExInStore = true;
                }

                d.resolve(item);

            });
        });
        return d.promise;
    }
    vm.IsNumeric = function ($e) {
        console.log($e);
        var keyCode = $e.which ? $e.which : $e.keyCode;
        var ret = ((keyCode >= 48 && keyCode <= 57) || specialKeys.indexOf(keyCode) != -1);
        if (!ret)
            $e.preventDefault();
    }
    function addressTypeChanged(lineitem, addressType) {
        angular.forEach(lineitem.ShippingAddress, function (value, key) {
            console.log(key + ': ' + value);
            if (key == 'Street1' || key == 'Street2' || key == 'City' || key == 'State' || key == 'Zip' || key == 'Country' || key == 'Phone1' || key == 'Phone2' || key == 'Phone3') {
                lineitem.ShippingAddress[key] = null;
            }

        });

        lineitem.xp.addressType = addressType;

    }
    var storesData;
    PdpService.GetStores().then(function (res) {
        storesData = res.data.stores;
        vm.storeNames = _.pluck(res.data.stores, 'storeName');
    });
    function storesDetails(item, line, name) {
        var store = line;
        var filt = _.filter(storesData, function (row) {
            return _.indexOf([item], row.storeName) > -1;
        });
        if (store.ShippingAddress == null)
            store.ShippingAddress = {};

        store.ShippingAddress.Street1 = filt[0].storeAddress;
        store.ShippingAddress.City = filt[0].city;
        store.ShippingAddress.State = filt[0].state;
        store.ShippingAddress.Zip = parseInt(filt[0].zipCode);
        store.ShippingAddress.CompanyName = name
        store.xp.DeliveryMethod = "InStorePickUp";

        PdpService.GetPhoneNumber(filt[0].phoneNumber).then(function (res) {
            store.ShippingAddress.Phone1 = res[0];
            store.ShippingAddress.Phone2 = res[1];
            store.ShippingAddress.Phone3 = res[2];
        });

        //vm.checkDeliverymethod(line, index)
    };
    var hospitalData;
    PdpService.GetHospitals().then(function (res) {
        hospitalData = res;
        vm.hospitalNames = _.pluck(hospitalData, 'AddressName');
    });
    function hospitalDetails(item, line, name) {
        var hospital = line;
        var filt = _.filter(hospitalData, function (row) {
            return _.indexOf([item], row.AddressName) > -1;
        });
        if (hospital.ShippingAddress == null)
            hospital.ShippingAddress = {};
        hospital.ShippingAddress.Street1 = filt[0].Street1;
        hospital.ShippingAddress.Street2 = filt[0].Street2;
        hospital.ShippingAddress.City = filt[0].City;
        hospital.ShippingAddress.State = filt[0].State;
        hospital.ShippingAddress.Zip = parseInt(filt[0].Zip);
        hospital.ShippingAddress.CompanyName = name
        if (filt[0].Phone) {
            hospital.ShippingAddress.Phone1 = filt[0].Phone.substr(0, 3);
            hospital.ShippingAddress.Phone2 = filt[0].Phone.substr(3, 3);
            hospital.ShippingAddress.Phone3 = filt[0].Phone.substr(6);
        }
        // PdpService.GetOldPhoneNumber(filt[0].phoneNumber).then(function (res) {
        // 	store.ShippingAddress.Phone1 = res[0];
        // 	store.ShippingAddress.Phone2 = res[1];
        // 	store.ShippingAddress.Phone3 = res[2];
        // });
        // vm.checkDeliverymethod(line, index)
    };
    var funeralHomeData;
    PdpService.GetFuneralHomes().then(function (res) {
        funeralHomeData = res;
        vm.funeralHomes = _.pluck(funeralHomeData, 'AddressName');
    });
    vm.funeralHomeDetails = funeralHomeDetails;
    function funeralHomeDetails(item, line, name) {
        var funeralHome = line;
        var filt = _.filter(funeralHomeData, function (row) {
            return _.indexOf([item], row.AddressName) > -1;
        });
        if (funeralHome.ShippingAddress == null)
            funeralHome.ShippingAddress = {};
        //store.ShippingAddress.FirstName = filt[0].storeName;
        //store.ShippingAddress.LastName = filt[0].storeName;
        funeralHome.ShippingAddress.Street1 = filt[0].Street1;
        funeralHome.ShippingAddress.Street2 = filt[0].Street2;
        funeralHome.ShippingAddress.City = filt[0].City;
        funeralHome.ShippingAddress.State = filt[0].State;
        funeralHome.ShippingAddress.Zip = parseInt(filt[0].Zip);
        funeralHome.ShippingAddress.CompanyName = name
        if (filt[0].Phone) {
            funeralHome.ShippingAddress.Phone1 = filt[0].Phone.substr(0, 3);
            funeralHome.ShippingAddress.Phone2 = filt[0].Phone.substr(3, 3);
            funeralHome.ShippingAddress.Phone3 = filt[0].Phone.substr(6);
        }
        // PdpService.GetPhoneNumber(filt[0].phoneNumber).then(function (res) {
        // 	store.ShippingAddress.Phone1 = res[0];
        // 	store.ShippingAddress.Phone2 = res[1];
        // 	store.ShippingAddress.Phone3 = res[2];
        // });

        vm.checkDeliverymethod(line, index)
    };
    var churchData;
    PdpService.GetChurches().then(function (res) {
        churchData = res;
        vm.churchNames = _.pluck(churchData, 'AddressName');
    });
    vm.churchDetails = churchDetails;
    function churchDetails(item, line, name) {
        var church = line;
        var filt = _.filter(churchData, function (row) {
            return _.indexOf([item], row.AddressName) > -1;
        });
        if (church.ShippingAddress == null)
            church.ShippingAddress = {};
        //store.ShippingAddress.FirstName = filt[0].storeName;
        //store.ShippingAddress.LastName = filt[0].storeName;
        church.ShippingAddress.Street1 = filt[0].Street1;
        church.ShippingAddress.Street2 = filt[0].Street2;
        church.ShippingAddress.City = filt[0].City;
        church.ShippingAddress.State = filt[0].State;
        church.ShippingAddress.Zip = parseInt(filt[0].Zip);
        church.ShippingAddress.CompanyName = name
        if (filt[0].Phone) {
            church.ShippingAddress.Phone1 = filt[0].Phone.substr(0, 3);
            church.ShippingAddress.Phone2 = filt[0].Phone.substr(3, 3);
            church.ShippingAddress.Phone3 = filt[0].Phone.substr(6);
        }
        // PdpService.GetPhoneNumber(filt[0].phoneNumber).then(function (res) {
        // 	store.ShippingAddress.Phone1 = res[0];
        // 	store.ShippingAddress.Phone2 = res[1];
        // 	store.ShippingAddress.Phone3 = res[2];
        // });

        // vm.checkDeliverymethod(line, index)
    };
    var CemeteryData;
    PdpService.Getcemeteries
    PdpService.Getcemeteries().then(function (res) {
        CemeteryData = res;
        vm.cemeteries = _.pluck(CemeteryData, 'AddressName');
    });
    vm.cemeteryDetails = cemeteryDetails;
    function cemeteryDetails(item, line, name) {
        var cemetery = line;
        var filt = _.filter(CemeteryData, function (row) {
            return _.indexOf([item], row.AddressName) > -1;
        });
        if (cemetery.ShippingAddress == null)
            cemetery.ShippingAddress = {};
        //store.ShippingAddress.FirstName = filt[0].storeName;
        //store.ShippingAddress.LastName = filt[0].storeName;
        cemetery.ShippingAddress.Street1 = filt[0].Street1;
        cemetery.ShippingAddress.Street2 = filt[0].Street2;
        cemetery.ShippingAddress.City = filt[0].City;
        cemetery.ShippingAddress.State = filt[0].State;
        cemetery.ShippingAddress.Zip = parseInt(filt[0].Zip);
        cemetery.ShippingAddress.CompanyName = name
        if (filt[0].Phone) {
            cemetery.ShippingAddress.Phone1 = filt[0].Phone.substr(0, 3);
            cemetery.ShippingAddress.Phone2 = filt[0].Phone.substr(3, 3);
            cemetery.ShippingAddress.Phone3 = filt[0].Phone.substr(6);
        }
        // PdpService.GetPhoneNumber(filt[0].phoneNumber).then(function (res) {
        // 	store.ShippingAddress.Phone1 = res[0];
        // 	store.ShippingAddress.Phone2 = res[1];
        // 	store.ShippingAddress.Phone3 = res[2];
        // });

        // vm.checkDeliverymethod(line, index)
    };
}
function editCartPopupController($uibModal, $scope, $uibModalInstance, OrderCloud) {
    var vm = this;
    vm.cancel = cancel;
    function cancel() {
        $uibModalInstance.dismiss('cancel');
    };
}