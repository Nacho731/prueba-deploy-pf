import { User as UserModel } from "../models/User";
import { Balance as BalanceModel } from "../models/Balance";
import { sequelize } from "../db";
import * as bcrypt from "bcrypt"; // para hashear passwords
import * as jwt from "jsonwebtoken"; // token generator
import * as nodemailer from "nodemailer"; // servicio de email automatico
import * as fs from "fs"; // template mail HTML carpeta root
import config from "../lib/config";

// Envio de emails NO TOCAR!!!
  // Transporter para enviar mails
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    auth: {
      user: config.gmail,
      pass: config.pass, //
    },
  });
  // Emails HTML Templates
  const premiumHtml = fs.readFileSync("premiumEmail.html", "utf-8");
  const welcomeHtml = fs.readFileSync("newsLetter.html", "utf-8");
  // send mail with defined transport object
  // let info = transporter.sendMail({
  //   from: "<walletwise23@gmail.com>",
  //   to: user.email,
  //   subject: "Thank you for subscribing to WalletWise",
  //   text: "Hola TyperEscripter",
  //   html: welcomeHtml,
  // });
// interface para el model del User
export interface IUser extends UserModel {
  name: string;
  email: string;
  picture: string;
  password: string;
  premium: boolean;
  balance: BalanceModel;
}

//////////// Registro del usuario ////////////////
export const createUser = async (user: IUser, balanceData: any) => {
  const transaction = await sequelize.transaction();

  try {
    // Hasheo de password
    const hashedPassword = bcrypt.hashSync(user.password, 10);
    user.password = hashedPassword;

    const newUser = await UserModel.create(user, { transaction });

    balanceData.userId = newUser.id;

    const balance = await BalanceModel.create(balanceData, { transaction });

    await transaction.commit();

    const generateAccessToken = (user: IUser) => {
      const accessToken = jwt.sign({ userId: user.email }, config.secret, {
        expiresIn: "1h",
      });

      return accessToken;
    };
    // Generar Token para nuevo usuario
    const accessToken = generateAccessToken(newUser);

    // Se envia al usuario email de bienvenida
    let info = transporter.sendMail({
      from: "<walletwise23@gmail.com>",
      to: user.email,
      subject: "Thank you for subscribing to WalletWise",
      text: "Hola TyperEscripter",
      html: welcomeHtml,
    });

    return { newUser, balance, accessToken };
  } catch (error) {
    await transaction.rollback();

    throw Error("error in the creation");
  }
};

/////////////// Login del usuario  /////////////////////
export const loginUser = async (email: string, password: string) => {
  // Busca el mail en la base de datos
  const user = await UserModel.findOne({ where: { email } });
  // Tira error si no encuentra
  if (!user) {
    throw new Error("Please enter a valid username");
  }
  // Chequea que la password y el hash coicidan
  const passwordMatch = await bcrypt.compare(password, user.password);
  // Si no coinciden tira error
  if (!passwordMatch) {
    throw new Error("Invalid password. Please try again");
  }
  // Genera Token y lo retorna al front
  const accessToken = jwt.sign({ user, email: user.email }, config.secret, {
    expiresIn: "1h",
  });
  return accessToken;
};

////////// Cambiar usuario a premium //////////////////
export const updateUser = async (id: number) => {
  const user = await UserModel.findByPk(id);
  if (!user) {
    throw new Error("No user found");
  }
  const toggle = user.premium;
  UserModel.update({ premium: !toggle }, { where: { id } });

  //Email al usuario
  let info = transporter.sendMail({
    from: "<walletwise23@gmail.com>",
    to: user.email,
    subject: "Thank you for subscribing to WalletWise",
    text: "Hola TyperEscripter",
    html: premiumHtml,
  });

  return `the suscription has changed from ${toggle} succesfully to ${!toggle}`;
};

export const getAllUsers = async () => {
  const users = await UserModel.findAll({
    include: [{ model: BalanceModel, attributes: ["total"] }],
  });
  return users;
};

export const getOneUser = async (id: number) => {
  const user = await UserModel.findOne({
    where: { id: id },
    include: [{ model: BalanceModel, attributes: ["total"] }],
  });
  if (!user) throw new Error("No user found");

  return user;
};
